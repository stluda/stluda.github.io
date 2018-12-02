## Protobuf

Google Protocol Buffer(简称 Protobuf)是一种轻便高效的结构化数据存储格式，平台无关、语言无关、可扩展，可用于**通讯协议**和**数据存储**等领域。

与XML相比，Protobuf更小，更快，更简单。关于Protobuf的介绍网上很多资料，这里就不花篇幅去介绍了，本项目的通讯就利用了Protobuf来进行数据的序列化及反序列化操作。不过项目里的Protobuf类的设计其实存在一些不太合理的地方，但意识到这一点时已经有点晚了，现在再改动Protobuf结构的话服务端客户端需要做的改动就太多了，工作量太大。

不过这也是一次不错的经验教训，通过这次教训我知道了Protobuf的设计必须要慎重，发现问题最好能在早期改好，不然项目进行到后期那真的是牵一发而动全身，任何一点小的改动都可能花费巨大成本。



以下我将讲一下项目里Protobuf类构建的思路，以及这样设计为什么不合理(语言版本为Protobuf3)：



首先，客户端发送的请求的类型要有所区分，得让服务端知道客户端想做什么，是登录还是查询还是做什么别的事情，因此首先定义请求的类型枚举： 

```protobuf
enum Type {
	REGISTER = 0;//注册 
	LOGIN = 1;//登录
	ADD_JOB_QUERY = 2;//添加查询
	DELETE_JOB_QUERY = 3;//删除查询
	GET_JOB_DETAIL = 4;//获取职位详情
	ADD_TASK = 5;//添加任务
	GET_TASK_LIST = 6;//获取任务清单
	GET_TASK_QUERY_RESULT_CHANGED_TIME = 7;//获取上次任务查询结果发生变化的时间
	GET_TASK_QUERY_RESULT = 8;//获取任务的查询结果
	DELETE_TASK = 9;//删除任务
}
```



然后是请求数据包的结构：

```protobuf
message Request {
	Type type = 1;//类型
	int64 request_time = 2;//请求时间
	string username = 3;//用户名
	string password = 4;//密码
	string email = 5;//email
	string session = 6;//session_id
	int32 id = 7; //get/delete操作可以用到，可以是job_id，也可以是task_id，根据type来确定具体是什么值
	JobQueryOption job_query_option = 8;//进行查询时需要提供的参数
	AddTaskOption job_query_task_option = 9;//添加任务时需要提供的参数
	GetTaskQueryResultOption get_task_detail_option = 10;//获取任务查询结果时需要提供的参数
}
```

其中JobQueryOption、AddTaskOption、GetTaskQueryResultOption是自定义的Protobuf类，分别在进行查询操作、添加任务操作、获取任务查询结果操作时会用到。



最后是响应数据包的结构：

```protobuf
message Response {
	Type type = 1;//类型
	int64 request_time = 2;//请求时间
	ErrorCode error_code = 3; //如果成功，error_code返回SUCCESS，否则则返回失败原因ENUM
	string session = 4;//session_id
	JobRelatedInfo job_related_info = 5;//职位的种类映射数据，包括职位类别、工作地点等数据
	JobQueryResultInfo job_query_result_info = 6;//用户所持有的查询结果的概要
	JobQueryResult job_query_result = 7;//请求类型为"查询"时，返回查询结果
	Job job_detail = 8;//请求类型为"职位详情时"，返回职位数据
	repeated Task task_list = 9;//请求类型为"获取任务清单"时，返回任务清单数据
	int64 task_query_result_changed_time = 10;//上次任务查询结果发生变化的时间
}
```

看到这里大家应该也发现不合理之处了。没错，不合理的地方在于不管是什么类型的请求、什么类型的响应，全部使用了同种结构Protobuf，这使得Protobuf类变成了"大杂烩"，显得十分臃肿。

其实这样做效率上倒是没什么问题，因为这些参数都是允许为空的，比如说密码只有在登录时才需要填，而进行查询时需要提供的参数只有请求类型为"查询"时才需要填，所以数据包本身并不会有多余的数据导致包大小”虚胖“。

问题出在可维护性和可读性上面。

在项目初期，因为很多功能还没加上，所以请求的种类比较少，所以那个时候还不觉得有什么不妥，但随着功能的丰富、请求种类的增加，才终于发现了问题。



合理的设计其实应该像下面这样才对：

```protobuf
message LoginRequest {//登录请求
	int64 request_time = 1;//请求时间
	string username = 2;//用户名
	string password = 3;//密码
}

message LoginResponse {//登录响应
	int64 request_time = 1;//请求时间
	ErrorCode error_code = 2; //如果成功，error_code返回SUCCESS，否则则返回失败原因
	string session = 3;//session_id
}

message QueryRequest {//查询请求
	int64 request_time = 1;//请求时间
	string session = 2;//session
	JobQueryOption job_query_option = 3;//进行查询时需要提供的参数
}

message QueryResponse {//查询响应
	int64 request_time = 1;//请求时间
	ErrorCode error_code = 2; //如果成功，error_code返回SUCCESS，否则则返回失败原因
	JobQueryResult job_query_result = 3;//查询结果
}

...
```

从第一步进行枚举类型的设计时，其实就已经走错了，不同类型的请求和响应数据就不应该混杂在一块儿。请求类型码其实根本不需要放在Protobuf对象里，完全可以单独提取出来放在外面，这样做的话数据结构会清晰很多，也便于维护。



那么当初设计时为什么会设计成这样呢，其实是受了以往使用xml和json时的影响。比方说登录的请求数据，如果用xml或json实现的话：

```xml
<request>
    <type>login</type>
    <request_time>...</request_time>
    <username>...</username>
    <password>...</password>
</request>
```

```json
{
    "type":"login",
    "request_time":...,
    "username":"...",
    "password":"..."
}
```

引入类型码是不是看起来很自然毫无违和感？我思考着为什么会有这种差别，最后发现是语言属性导致的。

xml和json都是其实都是解释型语言，它们的结构能够在程序运行时被动态解析出来。不管是登录的请求，还是查询的请求，就算请求的数据结构完全不同，但只要保证它们有共通的属性type，就能反序列化成相应的对象。



但这种套路是不适用于Protobuf的，因为Protobuf是一种编译型语言，它们的结构是预先编译好的，接收方收到数据想要解析，必须预先知道数据的结构，才能反序列化成相应的对象。而如果请求数据的结构类型不一样的话，接收方不知道应该用哪种结构进行反序列化，这就是我为什么要把登录查询等各种请求都放在同个Protobuf类里的原因，而这么做的后果大家也看到了：Protobuf类变得臃肿，可读性差，维护性差，使用Protobuf大概只剩下数据的体积比较小这个优点了。



而如果把xml和json的经验抛开，不要将类型码放在Protobuf结构中而是另外提供的话，就可以根据不同类型用不同的结构去反序列化，解决可读性和维护性的问题了，这才是正确使用Protobuf来传输数据的方式。



总结一下，Protobuf和json/xml相比其实各有优缺点：

| 语言 | 优点 | 缺点 |
| :---- | :---- | :---- |
| Protobuf | 二进制格式存储，体积小、序列化反序列化速度快 | 编码成本较高 |
| json/xml | 灵活、编码成本低 | 字符串格式存储，体积大、序列化反序列化速度慢 |

Protobuf效率确实是高，但对于一些对数据大小、序列化反序列化效率要求不高的场景，或许还是json/xml更加合适。

当然像是本项目这样用来传输数据的话，还是Protobuf更加合适，只是Protobuf结构的设计一定要合理。



毕竟本项目的Protobuf结构设计是一种反面教材，这里就不把全部代码拿出来献丑了。