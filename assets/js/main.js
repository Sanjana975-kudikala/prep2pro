let extractedText = "";
let conversationHistory = [];
let questionCount = 0;
const MAX_QUESTIONS = 30;

// Speech Setup
const synth = window.speechSynthesis;
let recognition;
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('user-input').value = transcript;
        setTimeout(() => sendAnswer(curComp, curRole, curLev), 500);
    };
}

let curComp, curRole, curLev;

function speak(text) {
    if (synth.speaking) synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    synth.speak(utter);
}

// PDF Parsing
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

document.getElementById('resume-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const uploadText = document.getElementById('upload-text');
    uploadText.innerText = "Processing...";
    const reader = new FileReader();
    reader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(" ");
        }
        extractedText = text;
        uploadText.innerText = "Resume Ready!";
        document.getElementById('upload-icon').className = "fa-solid fa-circle-check text-4xl text-emerald-500";
    };
    reader.readAsArrayBuffer(file);
});

async function processResume() {
    curComp = document.getElementById('company-name').value;
    curRole = document.getElementById('job-role').value;
    curLev = document.getElementById('difficulty-level').value;

    if (!extractedText || !curComp || !curRole) return alert("Fill all fields and upload resume.");

    showLoading("Analyzing Resume for " + curComp + "...");
    const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume: extractedText, company: curComp, role: curRole, level: curLev })
    });
    const data = await res.json();
    renderAnalysisView(data.feedback, curComp, curRole, curLev);
}

function renderAnalysisView(feedback, company, role, level) {
    // Clean Markdown bolding and format bullets
    let cleanFeedback = feedback
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-400 font-bold">$1</strong>')
        .replace(/\* /g, '• ')
        .replace(/\n/g, '<br>');

    document.getElementById('dynamic-title').innerHTML = "Resume <span class='gradient-text'>Analysis Report</span>";
    document.getElementById('app-container').innerHTML = `
        <div class="glass rounded-3xl p-8 md:p-12 shadow-2xl animate-fadeIn">
            <div class="mb-8">
                <h3 class="text-white text-xl mb-4 font-bold flex items-center">
                    <i class="fa-solid fa-clipboard-check text-blue-400 mr-3"></i> AI Recommendations
                </h3>
                <div class="bg-slate-900/80 p-8 rounded-2xl border border-slate-800 text-slate-300 leading-relaxed max-h-96 overflow-y-auto">
                    ${cleanFeedback}
                </div>
            </div>
            <button onclick="initiateInterview('${company}', '${role}', '${level}')" 
                class="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20 transition">
                Start Practice Interview Session
            </button>
        </div>
    `;
}

function initiateInterview(company, role, level) {
    currentCompany = company; currentRole = role; currentLevel = level;
    document.getElementById('dynamic-title').innerHTML = "Live <span class='gradient-text'>Voice Session</span>";
    
    document.getElementById('app-container').innerHTML = `
        <div class="glass rounded-3xl h-[600px] flex flex-col overflow-hidden animate-fadeIn">
            <div id="chat-box" class="flex-1 overflow-y-auto p-6 space-y-4 chat-scroll"></div>
            <div class="p-6 bg-slate-900/50 border-t border-slate-800">
                <div class="flex gap-4">
                    <input type="text" id="user-input" placeholder="Speak or type..." class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none text-white focus:border-blue-500">
                    <button onclick="recognition.start()" class="bg-indigo-600 hover:bg-indigo-500 px-5 rounded-xl transition">
                        <i class="fa-solid fa-microphone"></i>
                    </button>
                    <button onclick="sendAnswer('${company}', '${role}', '${level}')" class="bg-blue-600 hover:bg-blue-700 px-6 rounded-xl font-bold transition">
                        Send
                    </button>
                    <button onclick="endSession()" class="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-5 rounded-xl border border-red-500/20 font-bold transition">
                        End
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const intro = `Hello! I am your interviewer for the ${role} position at ${company}. Let's begin the technical round.`;
    appendMessage('Interviewer', intro);
    speak(intro);
    // Ensure initial greeting is in history
    conversationHistory.push({ role: "assistant", content: intro });
}


async function sendAnswer(company, role, level) {
    const input = document.getElementById('user-input');
    const answer = input.value;
    if (!answer) return;
    input.value = "";

    if (answer.toLowerCase().includes("end interview") || questionCount >= MAX_QUESTIONS) return endSession();

    appendMessage('You', answer);
    questionCount++;

    const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer, history: conversationHistory, company, role, level, resume: extractedText })
    });
    const data = await res.json();
    conversationHistory.push({ role: "user", content: answer }, { role: "assistant", content: data.question });
    appendMessage('Interviewer', data.question);
    speak(data.question);
}

function appendMessage(sender, text) {
    const chatBox = document.getElementById('chat-box');
    const style = sender === 'You' ? 'ml-auto bg-blue-600' : 'mr-auto bg-slate-800';
    chatBox.innerHTML += `<div class="max-w-[80%] ${style} p-4 rounded-2xl text-sm"><p class="text-[10px] font-bold opacity-50 mb-1">${sender}</p>${text}</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
}

function showLoading(msg) {
    document.getElementById('app-container').innerHTML = `<div class="glass rounded-3xl p-20 text-center animate-pulse"><i class="fas fa-spinner animate-spin text-5xl mb-6"></i><p>${msg}</p></div>`;
}

async function endSession() {
    showLoading("Generating Final Performance Scorecard...");
    
    try {
        const res = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: conversationHistory })
        });
        
        const data = await res.json();
        
        // Pass the raw AI text to our cleaning renderer
        renderFinalReport(data.report);
        
        speak("The interview is complete. Your scorecard has been generated.");
        
    } catch (err) {
        console.error("Report Error:", err);
        alert("Failed to generate report. Check your internet connection.");
    }
}

function renderFinalReport(reportContent) {
    // 1. Convert Markdown bolding to HTML and clean bullets
    let cleanReport = reportContent
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-400 font-bold">$1</strong>')
        .replace(/\* /g, '• ')
        .replace(/\n/g, '<br>');

    document.getElementById('dynamic-title').innerHTML = "Final <span class='gradient-text'>Interview Scorecard</span>";

    document.getElementById('app-container').innerHTML = `
        <div id="printable-report" class="glass rounded-3xl p-8 md:p-12 shadow-2xl animate-fadeIn border border-blue-500/20">
            <div class="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                <h3 class="text-2xl font-bold text-white flex items-center">
                    <i class="fa-solid fa-chart-line text-blue-400 mr-3"></i> Performance Analysis
                </h3>
                <span class="text-slate-500 font-mono text-sm no-print">Session ID: PR-2026-${Math.floor(Math.random()*1000)}</span>
            </div>

            <div class="bg-slate-900/90 p-8 rounded-2xl border border-slate-800 text-slate-300 leading-relaxed overflow-y-auto max-h-[500px] mb-8">
                ${cleanReport}
            </div>

            <div class="mt-8 flex gap-4 no-print">
                <button onclick="window.location.reload()" class="flex-1 bg-slate-800 hover:bg-slate-700 py-4 rounded-xl font-bold transition">
                    New Interview
                </button>
                <button onclick="prepareAndPrint()" class="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold transition">
                    Download PDF Report
                </button>
            </div>
        </div>
    `;
}
function prepareAndPrint() {
    // Add temporary print styles to ensure content is visible
    const style = document.createElement('style');
    style.innerHTML = `
        @media print {
            .no-print, nav, header { display: none !important; }
            body { background: white !important; color: black !important; }
            .glass { background: white !important; border: 1px solid #ccc !important; backdrop-filter: none !important; color: black !important; }
            .bg-slate-900/90 { background: white !important; color: black !important; border: none !important; }
            #app-container { margin: 0 !important; padding: 0 !important; width: 100% !important; }
        }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
}
function renderFinalReport(reportContent) {

    let cleanReport = reportContent
        .replace(/\*\*(.*?)\*\*/g, '$1')   // remove **bold**
        .replace(/\*/g, '')               // remove stray *
        .replace(/\n/g, '<br>');          // keep line breaks

    document.getElementById('dynamic-title').innerHTML =
        "Final <span class='gradient-text'>Interview Scorecard</span>";

    document.getElementById('app-container').innerHTML = `
        <div class="glass rounded-3xl p-8 md:p-12 shadow-2xl animate-fadeIn">
            <h3 class="text-2xl font-bold text-white mb-6">
                Performance Analysis
            </h3>

            <div class="bg-slate-900/90 p-8 rounded-2xl text-slate-300 leading-relaxed">
                ${cleanReport}
            </div>

            <div class="mt-8 flex gap-4 no-print">
                <button onclick="window.location.reload()"
                    class="flex-1 bg-slate-800 py-4 rounded-xl font-bold">
                    New Interview
                </button>

                <button onclick="prepareAndPrint()"
                    class="flex-1 bg-blue-600 py-4 rounded-xl font-bold">
                    Download PDF Report
                </button>
            </div>
        </div>
    `;
}