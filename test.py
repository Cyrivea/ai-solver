def ls(lst):
    result = []
    for num in lst:
        if num not in result:
            result.append(num)
    return result    
lst = eval(input(""))
print(ls(lst))