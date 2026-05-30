// ==UserScript==
// @name         小助来喽
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  支持洛谷、EduCoder 题目抓取，特权级 GM_xmlhttpRequest 流式自检模式
// @author       Cyrivea
// @match        *://*.luogu.com.cn/*
// @match        *://*.educoder.net/*
// @match        *://222.25.3.166/*
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const DEFAULT_PROMPT = "你是一个 C++编程大神\n请直接给出题目的 C++ 完整代码解答\n不要注释，头文件用'#include<bits/stdc++.h> using namespace std;'\n符合标准 C++ 规范。";

    function createDraggableBtn() {
        if (document.getElementById('ai-helper-btn')) return;

        let btn = document.createElement('button');
        btn.id = 'ai-helper-btn';
        btn.innerHTML = "召唤小助";
        btn.style = "position:fixed; bottom:120px; right:30px; z-index:2147483647; padding:12px 20px; background:#ff5500; color:white; border:none; border-radius:8px; cursor:move; box-shadow:0 4px 15px rgba(0,0,0,0.5); font-weight:bold; user-select:none; display:block !important;";
        document.body.appendChild(btn);

        let isDragging = false;
        let startX, startY;

        btn.addEventListener('mousedown', (e) => {
            isDragging = false;
            startX = e.clientX - btn.getBoundingClientRect().left;
            startY = e.clientY - btn.getBoundingClientRect().top;

            const onMouseMove = (e) => {
                isDragging = true;
                btn.style.left = (e.clientX - startX) + 'px';
                btn.style.top = (e.clientY - startY) + 'px';
                btn.style.bottom = 'auto';
                btn.style.right = 'auto';
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        btn.onclick = function() {
            if (isDragging) return;
            let question = "";
            let selectors = ['.problem-content', '.markdown-body', '.task-description', 'article', '#problem-main'];

            for (let s of selectors) {
                let el = document.querySelector(s);
                if (el && el.innerText.length > 20) {
                    question = el.innerText;
                    break;
                }
            }

            if (!question || question.length < 10) {
                question = document.body.innerText.substring(0, 1000);
            }

            btn.innerText = "我想我想...";
            sendToAI(question);
        };
    }

    function sendToAI(text, isFollowUp = false) {
        let askBtn = document.getElementById('ask-btn');
        if (isFollowUp && askBtn) askBtn.innerText = "...";

        let currentPrompt = GM_getValue("custom_system_prompt", DEFAULT_PROMPT);

        if (!isFollowUp) {
            showPanel("🚀 正在建立本地安全自检通道...");
        }

        let seenLength = 0;
        let leftover = "";

        GM_xmlhttpRequest({
            method: "POST",
            url: "http://127.0.0.1:8000/solve",
            headers: { "Content-Type": "application/json" },
            // 注意：不加 responseType，让油猴默认处理
            data: JSON.stringify({
                question: text,
                system_prompt: currentPrompt
            }),
            onprogress: function(response) {
                let rawText = response.responseText || "";
                if (!rawText) return;

                let ta = document.getElementById('ai-code-text');
                if (!ta) return;

                let newText = rawText.substring(seenLength);
                seenLength = rawText.length;

                let toParse = leftover + newText;
                let parts = toParse.split("\n\n");
                leftover = parts.pop();

                for (let line of parts) {
                    line = line.trim();
                    if (!line.startsWith("data: ")) continue;
                    try {
                        let data = JSON.parse(line.slice(6).trim());

                        if (data.type === 'status') {
                            ta.value += "\n" + data.content + "\n";
                            ta.scrollTop = ta.scrollHeight;
                        } else if (data.type === 'code_stream') {
                            ta.value += data.content;
                            ta.scrollTop = ta.scrollHeight;
                        } else if (data.type === 'error') {
                            ta.value += "\n" + data.content + "\n";
                            ta.scrollTop = ta.scrollHeight;
                        } else if (data.type === 'final') {
                            let cleanCode = data.content.replace(/```cpp|```/g, "").trim();
                            if (!isFollowUp) {
                                ta.value = cleanCode;
                            } else {
                                ta.value += '\n\n--- 追问解答 ---\n\n' + cleanCode;
                            }
                            ta.scrollTop = ta.scrollHeight;
                        }
                    } catch(e) {
                        console.warn("SSE parse error:", e, "| line:", line);
                    }
                }
            },
            onload: function(response) {
                // onprogress 没触发时的保底：在 onload 里解析全量数据
                let ta = document.getElementById('ai-code-text');
                if (ta) {
                    let rawText = response.responseText || "";
                    let lines = rawText.substring(seenLength).split("\n\n");
                    for (let line of lines) {
                        line = line.trim();
                        if (!line.startsWith("data: ")) continue;
                        try {
                            let data = JSON.parse(line.slice(6).trim());
                            if (data.type === 'status' || data.type === 'error') {
                                ta.value += "\n" + data.content + "\n";
                            } else if (data.type === 'code_stream') {
                                ta.value += data.content;
                            } else if (data.type === 'final') {
                                let cleanCode = data.content.replace(/```cpp|```/g, "").trim();
                                if (!isFollowUp) {
                                    ta.value = cleanCode;
                                } else {
                                    ta.value += '\n\n--- 追问解答 ---\n\n' + cleanCode;
                                }
                            }
                        } catch(e) {}
                    }
                    ta.scrollTop = ta.scrollHeight;
                }
                document.getElementById('ai-helper-btn').innerText = "召唤小助";
                if (askBtn) askBtn.innerText = "发送";
            },
            onerror: function() {
                alert("后端连接失败！");
                document.getElementById('ai-helper-btn').innerText = "召唤小助";
            }
        });
    }

    function showPanel(code) {
        let old = document.getElementById('ai-panel');
        if (old) old.remove();

        let panel = document.createElement('div');
        panel.id = "ai-panel";
        panel.style = "position:fixed; top:60px; right:20px; width:450px; max-height:80vh; background:#1e1e1e; color:#d4d4d4; padding:20px; z-index:2147483647; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5); border:1px solid #ff5500; overflow-y:auto;";

        let htmlContent = '';
        htmlContent += '<div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">';
        htmlContent += '    <b style="color:#ff5500; font-size:16px;">小助建议 (流式自检模式)</b>';
        htmlContent += '    <div style="display:flex; gap:6px;">';
        htmlContent += '        <button id="config-btn" style="background:#333; color:#ccc; border:1px solid #555; padding:6px 10px; cursor:pointer; border-radius:4px; font-weight:bold;">⚙️</button>';
        htmlContent += '        <button id="copy-btn" style="background:#ff5500; color:white; border:none; padding:6px 15px; cursor:pointer; border-radius:4px; font-weight:bold;">复制答案</button>';
        htmlContent += '    </div>';
        htmlContent += '</div>';

        htmlContent += '<div id="prompt-config-area" style="display:none; background:#252526; border:1px solid #ff5500; padding:10px; border-radius:6px; margin-bottom:12px;">';
        htmlContent += '    <span style="font-size:12px; color:#ff5500; font-weight:bold; display:block; margin-bottom:6px;">⚙️ 自定义 System Prompt</span>';
        htmlContent += '    <textarea id="custom-prompt-text" style="width:100%; height:100px; background:#1e1e1e; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; font-size:12px; resize:vertical; font-family:sans-serif;"></textarea>';
        htmlContent += '    <div style="display:flex; justify-content:space-between; margin-top:8px;">';
        htmlContent += '        <button id="reset-prompt-btn" style="background:transparent; color:#aaa; border:1px solid #555; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:11px;">恢复默认</button>';
        htmlContent += '        <button id="save-prompt-btn" style="background:#ff5500; color:white; border:none; padding:4px 12px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">保存配置</button>';
        htmlContent += '    </div>';
        htmlContent += '</div>';

        htmlContent += '<textarea id="ai-code-text" style="width:100%; height:400px; background:#252526; color:#dcdcaa; border:1px solid #444; padding:10px; border-radius:6px; font-family:Consolas, monospace; font-size:13px; resize:none;"></textarea>';
        htmlContent += '<div style="margin-top:10px; display:flex; gap:8px;">';
        htmlContent += '    <input id="follow-up" type="text" placeholder="继续追问..." style="flex:1; background:#252526; color:#d4d4d4; border:1px solid #444; padding:8px; border-radius:4px;">';
        htmlContent += '    <button id="ask-btn" style="background:#ff5500; color:white; border:none; padding:8px 15px; cursor:pointer; border-radius:4px;">发送</button>';
        htmlContent += '</div>';
        htmlContent += '<div style="text-align:right; margin-top:10px;">';
        htmlContent += '    <button id="close-panel-btn" style="background:transparent; color:#888; border:none; cursor:pointer;">[关闭]</button>';
        htmlContent += '</div>';

        panel.innerHTML = htmlContent;
        document.body.appendChild(panel);

        document.getElementById('ai-code-text').value = code;

        let savedPrompt = GM_getValue("custom_system_prompt", DEFAULT_PROMPT);
        document.getElementById('custom-prompt-text').value = savedPrompt;

        document.getElementById('config-btn').onclick = function() {
            let configArea = document.getElementById('prompt-config-area');
            configArea.style.display = configArea.style.display === 'none' ? 'block' : 'none';
        };

        document.getElementById('save-prompt-btn').onclick = function() {
            let newPrompt = document.getElementById('custom-prompt-text').value.trim();
            if (!newPrompt) {
                newPrompt = DEFAULT_PROMPT;
                document.getElementById('custom-prompt-text').value = DEFAULT_PROMPT;
            }
            GM_setValue("custom_system_prompt", newPrompt);
            this.innerText = "已保存！";
            setTimeout(() => { this.innerText = "保存配置"; }, 1500);
        };

        document.getElementById('reset-prompt-btn').onclick = function() {
            if (confirm("确定要恢复默认的 C++ 助手提示词吗？")) {
                GM_setValue("custom_system_prompt", DEFAULT_PROMPT);
                document.getElementById('custom-prompt-text').value = DEFAULT_PROMPT;
            }
        };

        document.getElementById('ask-btn').onclick = function() {
            let q = document.getElementById('follow-up').value;
            if (q) sendToAI(q, true);
        };

        document.getElementById('close-panel-btn').onclick = function() {
            panel.remove();
        };

        document.getElementById('copy-btn').onclick = function() {
            let textArea = document.getElementById('ai-code-text');
            textArea.select();
            document.execCommand('copy');
            this.innerText = "复制成功！";
            setTimeout(() => { this.innerText = "复制答案"; }, 2000);
        };
    }

    setInterval(createDraggableBtn, 2000);
})();