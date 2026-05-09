from fastapi import FastAPI
from pydantic import BaseModel 
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from openai import OpenAI


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) 
load_dotenv(os.path.join(BASE_DIR, ".env"))

import os
from dotenv import load_dotenv

load_dotenv()

client  =  OpenAI(
    api_key=os.getenv("API_KEY"),
    base_url="https://open.bigmodel.cn/api/paas/v4/"
)

history = []

class QuestionModel(BaseModel):
    question: str

@app.post("/solve")
async def solve(data: QuestionModel): 
    question = data.question          
    history.append({"role": "user", "content": question})
    response = client.chat.completions.create(
        model="glm-4-flash",
        messages=[
            {'role': 'system', 'content':
            "你是一个 C++编程大神"
            "请直接给出题目的 C++ 完整代码解答"
            "不要注释，头文件用'#include<bits/stdc++.h> using namespace std;'"
            "符合标准 C++ 规范。"},
            {'role': 'user', 'content': question},
        ] + history
    )
    answer = response.choices[0].message.content  
    history.append({"role": "assistant", "content": answer})
    save_history(question, answer)
    return {"answer": answer}


@app.get("/")
def index():
    return {"message": "小助后端运行中"}

def save_history(question, answer):
    history_path = os.path.join(BASE_DIR, "data", "history.md")
    with open(history_path, "a", encoding="utf-8") as f:
        f.write(f"## 问题\n{question}\n\n## 答案\n{answer}\n\n---\n\n")