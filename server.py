from fastapi import FastAPI
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(
    api_key="71920f5ec5c3467287ae47e151eabeeb.rjLxgR9VM3Pe9Za4", 
    base_url="https://open.bigmodel.cn/api/paas/v4/"
)

@app.get("/solve")
def solve(question: str):
    response = client.chat.completions.create(
        model="glm-4-flash",
        messages=[
       
            {"role": "system", "content": "你是一个 C++编程大神，请直接给出题目的 C++ 完整代码解答，不要注释，头文件用'#include<stdc++.h> using namespace std;',符合标准 C++ 规范。"},
            {"role": "user", "content": question}
        ]
    )
    return {"answer": response.choices[0].message.content}