## 项目介绍-腾讯职位查询系统

腾讯职位查询系统（以下简称查询系统），面向腾讯的应聘者，为满足其复杂的查询需求而诞生。

腾讯本身提供[web端的招聘网](https://hr.tencent.com/)虽然也提供了职位搜索功能，但只是简单的正文查找，难以满足复杂的查询需求。

传统的网页高级搜索一般比起普通搜索会多个正文查找功能，或者分类别搜索。但光靠这个还是不够的。

比如说，某个Android职位应聘者，想寻找Android相关岗位，要求工作经历为1年以上。

虽然他可以通过关键词[Android 1年]来实现“与”查找（标题或正文同时包含“Anroid”、“1年”），但如果需求复杂一点的话，就没法实现了。比如说正文里包含Android关键字，但不包含JNI或c++的职位，虽然可以搜索Android然后再逐个确认排除，但这样毕竟效率太低。

基于这个问题，我设计编码了一个更高级的查询系统，以满足更加复杂的需求，系统提供的功能如下：

1. 允许使用表达式进行查询，满足更加复杂的查询需求。（如： 标题包含"高级"，地点为“深圳”，工作职责里包含“Android”或“c#”，但不包含“c++”的职位，可以用表达式进行查询：
   T{高级}&&L{深圳}&&R{(Android || c#) && !c++} （详情见查询表达式）
<br>![](/img/intro1.png) ![](/img/intro2.png)

2. 允许创建查询任务，如果目前并没有适合自己的职位，可以提供一个表达式给系统，系统在捕获到新职位时会进行判断是否满足表达式，如果满足表达式则会发送通知消息给用户。

这样一来，就解决了查询的复杂需求的问题，然后就算现在没有合适的职位，出现符合条件的职位时用户也能在第一时间得知。

整个项目分为了服务端及客户端两部分：
服务器端(Linux)：C++11(Boost)、python
客户端(Android)：Kotlin(RxJava2)

大概是这样的感觉