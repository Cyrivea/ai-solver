from openai import OpenAI

client = OpenAI(
    # 复制你截图里那个 "1st" 对应的 API Key 填到这里
    api_key="71920f5ec5c3467287ae47e151eabeeb.rjLxgR9VM3Pe9Za4", 
    base_url="https://open.bigmodel.cn/api/paas/v4/"
)

response = client.chat.completions.create(
    model="glm-4-flash", 
    messages=[
        {"role": "system", "content": "你是一个高冷的编程助教。"},
        {"role": "user", "content": "为什么 print(hello) 会报错？"}
    ]
)

print("AI 的回复：")
print(response.choices[0].message.content)