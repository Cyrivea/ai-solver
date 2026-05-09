// ==UserScript==
// @name         小助来喽
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  支持洛谷、EduCoder 题目抓取，C++ 代码一键召唤，支持拖拽
// @author       Cyrivea
// @match        *://*.luogu.com.cn/*
// @match        *://*.educoder.net/*
// @match        *://222.25.3.166/*
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

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

    // 封装统一的发送函数[cite: 1, 2]
    function sendToAI(text, isFollowUp = false) {
        let askBtn = document.getElementById('ask-btn');
        if(isFollowUp && askBtn) askBtn.innerText = "...";

        GM_xmlhttpRequest({
            method: "POST",
            url: "http://127.0.0.1:8000/solve",
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify({ question: text }),
            onload: function(response) {
                try {
                    let data = JSON.parse(response.responseText);
                    let cleanCode = data.answer.replace(/```cpp|```/g, "").trim();
                    if (!isFollowUp) {
                        showPanel(cleanCode);
                        document.getElementById('ai-helper-btn').innerText = "召唤小助";
                    } else {
                        document.getElementById('ai-code-text').value += '\n\n--- 追问 ---\n\n' + cleanCode;
                        askBtn.innerText = "发送";
                    }
                } catch(e) {
                    alert("解析失败");
                }
            },
            onerror: function() {
                alert("后端未启动");
                if(!isFollowUp) document.getElementById('ai-helper-btn').innerText = "召唤小助";
            }
        });
    }

    function showPanel(code) {
        let old = document.getElementById('ai-panel');
        if(old) old.remove();

        let panel = document.createElement('div');
        panel.id = "ai-panel";
        panel.style = "position:fixed; top:60px; right:20px; width:450px; max-height:80vh; background:#1e1e1e; color:#d4d4d4; padding:20px; z-index:2147483647; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5); border:1px solid #ff5500; overflow-y:auto;";

        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
                <b style="color:#ff5500; font-size:16px;">小助建议 (C++)</b>
                <button id="copy-btn" style="background:#ff5500; color:white; border:none; padding:6px 15px; cursor:pointer; border-radius:4px; font-weight:bold;">复制答案</button>
            </div>
            <textarea id="ai-code-text" style="width:100%; height:400px; background:#252526; color:#dcdcaa; border:1px solid #444; padding:10px; border-radius:6px; font-family:Consolas, monospace; font-size:13px;">${code}</textarea>
            <div style="margin-top:10px; display:flex; gap:8px;">
                <input id="follow-up" type="text" placeholder="继续追问..." style="flex:1; background:#252526; color:#d4d4d4; border:1px solid #444; padding:8px; border-radius:4px;">
                <button id="ask-btn" style="background:#ff5500; color:white; border:none; padding:8px 15px; cursor:pointer; border-radius:4px;">发送</button>
            </div>
            <div style="text-align:right; margin-top:10px;">
                <button onclick="this.parentElement.parentElement.remove()" style="background:transparent; color:#888; border:none; cursor:pointer;">[关闭]</button>
            </div>
        `;
        document.body.appendChild(panel);

        document.getElementById('ask-btn').onclick = function() {
            let q = document.getElementById('follow-up').value;
            if (q) sendToAI(q, true);
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