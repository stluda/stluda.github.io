## 查询

虽然系统最强大的功能是高度自由的表达式查询，但为了照顾一般用户，也提供容易上手的简易查询模式，如下图：

![](/img/intro/query/a.png) ![](/img/intro/query/b.png)



而在简易查询不足以满足用户需求的情况下，可以切换到表达式查询模式，通过输入[查询表达式](/manual/query/exp.md)，进行高度定制化的复杂查询，服务端在经过计算后会返回查询结果。

先来举个简单的例子，比如说我想查找标题里含有"C++"的职位，那么就先输入对应的表达式：``T{C++}``



![](/img/intro/query/01.png)

其中T为类型代码，代表被查对象是标题，而花括号里的"C++"则是关键词，整个表达式的含义为**标题**里含有**C++**的职位。输入完关键词后，我们点击**新建查询**按钮。

紧接着会弹出一个预览框，会将表达式翻译成自然语言，让我们确认刚刚输入的表达式是不是我们所想要的。

![](/img/intro/query/02.png)



确认无误后点击确定后，客户端会发送请求，服务器在经过计算后会返回结果。注意结果里的职位会有"已读"和"未读"的标记，这是因为有些职位我们可能以前在别的查询结果里已经预览过，我们可以根据自己的需求跳过"已读"职位来节省时间。

![](/img/intro/query/03.png)



如果返回的结果比较多，我们还可以点击右上角的过滤器按钮来缩小范围。

![](/img/intro/query/04.png)



从列表里找到感兴趣的职位后，单击列表项即可浏览职位详情，如果觉得这个职位适合自己，还可以点击右上角的收藏按钮，加入"我的收藏"，方便以后预览。

![](/img/intro/query/05.png)



当然我们还可以进行更加复杂一点的查询，比方说有这么一个技术应聘者：他想找搜索方面的工作，掌握的语言有C++、python、java，想在深圳工作，想充分发挥自己硕士的学历的优势，但由于家庭原因他不希望出差。

那么这个应聘者就可以将自己的需求通过表达式的方式写出来，进行定制化的查询，我们来逐步分析一下：

* 想找搜索方面的工作，那么工作要求或工作职责里面自然要包含"搜索"
* 想在深圳工作，地点里应包含"深圳"
* 想发挥硕士学历的优势，工作要求里应包含"硕士"
* 不希望出差，那么工作要求里应不包含出差
* 掌握的语言有C++、python、java，那么工作要求里应包含C++、python、java至少其中一个

那么他就可以把这些需求通过表达式写出来：``( R{搜索} || D{搜索} ) && L{深圳} && R{(C++ || python || java) && 硕士 && !出差}``


![](/img/intro/query/06.png) ![](/img/intro/query/07.png)

查询表达式的详细语法参见[附录-查询表达式](/manual/query/exp.md)



讲到这里有人可能会说了，这么多符号，在移动端输入不是很不方便？而且表达式的使用门槛会不会太高了？ 不用担心，这两个问题已经考虑到了，请注意这些按钮：

![](/img/intro/query/08.png)

**首先是符号的问题**。需要用到的符号，除了用手机的软键盘输入以外，还可以直接通过按钮输入符号，甚至有更快捷的输入方式，比方说按下``标题``按钮的话，会弹出一个输入框：

![](/img/intro/query/09.png)

输入内容按下确定后，就会自动生成对应的表达式项：

![](/img/intro/query/10.png)

所有按钮的功能如下：
* ``{``、``(``、``&&``、``||``、``!``、``)``、``}``：输入对应的符号
* ``标题``：按下按钮后，弹出输入框，通过输入的内容，生成T{内容}
* ``类别``：按下按钮后，弹出输入框，通过输入的内容，生成TY{内容}
* ``地点``：按下按钮后，弹出输入框，通过输入的内容，生成L{内容}
* ``人数``：按下按钮后，弹出输入框，通过输入的内容，生成H{内容}
* ``职责``：按下按钮后，弹出输入框，通过输入的内容，生成D{内容}
* ``要求``：按下按钮后，弹出输入框，通过输入的内容，生成R{内容}
* ``输入内容``：按下按钮后，弹出输入框，通过输入的内容，生成对应内容
* ``退格``：退格
* ``软键盘模式``：进入全屏编辑模式，并弹出软键盘
* ``表达式向导``：通过向导创建表达式，也就是所谓的"傻瓜"模式
* ``新建查询``：通过输入的表达式新建查询



解释一下软键盘模式，因为按钮的数量太多，而软键盘会出现在手机屏幕底部，会占据半张屏幕，这样输入框和按钮就没办法全部显示了，因此在主编辑界面禁用了软键盘，但可以通过点击软键盘模式进入全屏编辑界面。



**其次是表达式的使用门槛问题**，对初次接触程序的用户，去记表达式的语法不是一件容易的事情，因此也为初学者提供了"傻瓜"模式，点击表达式向导后会弹出向导框：

![](/img/intro/query/11.png)![](/img/intro/query/12.png)

向导会逐步从标题、类别、地点、工作要求、工作职责，一步步让用户输入对应的条件，最后完成整个表达式，让就算是初次接触程序的用户也能简单的构建表达式。



要注意的是，为了减轻服务器负担，一个用户最多只会保留3个查询结果，当查询结果达到3个时将不允许创建新的查询，这时只要把旧的查询结果删除，就能继续创建新的查询了。删除的方法很简单，点击查询标签的删除按钮即可。



以上，就是查询模块的全部功能了。那么，如果通过表达式找不到符合需求的职位怎么办呢？

那也没关系，现在没有，不代表以后没有。接下来要讲的任务功能，就是用来解决这个问题的。