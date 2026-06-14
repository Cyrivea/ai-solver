import os
import subprocess
import json
import asyncio
from fastapi import FastAPI
from pydantic import BaseModel 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from openai import AsyncOpenAI 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))


client = AsyncOpenAI(
    api_key=os.getenv("API_KEY"),
    base_url="https://open.bigmodel.cn/api/paas/v4/"
)

class QuestionModel(BaseModel):
    question: str
    system_prompt: str = None 


def check_cpp_compilation(code: str) -> tuple[bool, str]:
    cpp_file = os.path.join(BASE_DIR, "temp.cpp")
    out_file = os.path.join(BASE_DIR, "temp.out")
    
    with open(cpp_file, "w", encoding="utf-8") as f:
        f.write(code)
        
    try:
        result = subprocess.run(
            ["g++", cpp_file, "-o", out_file, "-std=c++17"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            if os.path.exists(cpp_file): os.remove(cpp_file)
            if os.path.exists(out_file): os.remove(out_file)
            return True, "Success"
        else:
            if os.path.exists(cpp_file): os.remove(cpp_file)
            return False, result.stderr
    except Exception as e:
        if os.path.exists(cpp_file): os.remove(cpp_file)
        return False, str(e)


async def self_check_generator(question: str, system_prompt: str):
    default_system = (
        "你是一个 C++ 编程大神。请直接给出题目的 C++ 完整代码解答。\n"
        "不要注释，头文件用'#include<bits/stdc++.h> using namespace std;'\n"
        "符合标准 C++ 规范。注意：不要包含 markdown 标记外的任何废话。"
    )
    current_system = system_prompt if system_prompt else default_system

    local_messages = [
        {'role': 'system', 'content': current_system},
        {'role': 'user', 'content': question}
    ]
    
    max_retries = 3
    
    for attempt in range(max_retries):
        status_msg = f"🔄 正在进行第 {attempt + 1} 次代码生成与自检..." if attempt == 0 else f"🔄 正在进行第 {attempt + 1} 次自我修复与重试..."
        yield f"data: {json.dumps({'type': 'status', 'content': status_msg})}\n\n"
        await asyncio.sleep(0.05) 
        
        full_answer = ""
        try:
   
            response = await client.chat.completions.create(
                model="glm-4-flash",
                messages=local_messages,
                stream=True
            )
            
         
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    content_piece = chunk.choices[0].delta.content
                    full_answer += content_piece
                    
                    yield f"data: {json.dumps({'type': 'code_stream', 'content': content_piece})}\n\n"
                    
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': f'❌ 大模型调用失败: {str(e)}'})}\n\n"
            return

        clean_code = full_answer.replace("```cpp", "").replace("```", "").strip()
        
      
        is_valid, compile_error = check_cpp_compilation(clean_code)
        
        if is_valid:
            yield f"data: {json.dumps({'type': 'status', 'content': '🎉 本地自检编译通过！正在输出最优解...'})}\n\n"
            yield f"data: {json.dumps({'type': 'final', 'content': full_answer})}\n\n"
            save_history(question, full_answer)
            return
        else:
         
            yield f"data: {json.dumps({'type': 'error', 'content': f'❌ 第 {attempt + 1} 次编译错误：\n{compile_error}'})}\n\n"
            await asyncio.sleep(0.1)
            
       
            local_messages.append({'role': 'assistant', 'content': full_answer})
            local_messages.append({
                'role': 'user', 
                'content': f"你刚才生成的代码在编译时报错了。错误信息如下，请参考并给出修复后的完整代码，同样不需要任何注释：\n```\n{compile_error}\n```"
            })
            

    yield f"data: {json.dumps({'type': 'status', 'content': '⚠️ 已达到最大自检次数，输出最后一版候选项。'})}\n\n"
    yield f"data: {json.dumps({'type': 'final', 'content': full_answer})}\n\n"
    save_history(question, full_answer)

@app.post("/solve")
async def solve(data: QuestionModel): 
    return StreamingResponse(self_check_generator(data.question, data.system_prompt), media_type="text/event-stream")

@app.get("/")
def index():
    return {"message": "小助流式自检后端运行中"}

def save_history(question, answer):
    history_path = os.path.join(BASE_DIR, "data", "history.md")
    os.makedirs(os.path.dirname(history_path), exist_ok=True)
    with open(history_path, "a", encoding="utf-8") as f:
        f.write(f"## 问题\n{question}\n\n## 答案\n{answer}\n\n---\n\n")