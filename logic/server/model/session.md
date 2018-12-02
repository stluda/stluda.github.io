## 会话类

这个类的作用和逻辑比较简单，用户在登录后会创建一个会话类的实例，之后客户端发起各种增删查改操作，都会附带一个session_id；服务端在收到session_id后，会找到这个实例，进一步找到其对应的用户实例，来执行具体的业务逻辑。



属性和方法如下：



**实例属性：**

|属性名称|类型|描述|
|:-----|:-----|:------ |
| id | std::string | 会话id，用户登录时随机生成，作为后续通信表明身份的凭证。 |
| active_time | Base::DateTime | 该会话最后一次活动的时间 |
| user | User& | 对应的用户实例的引用 |

**实例方法**

| 实例方法 | 描述 |
| :------ | :--- |
| 各属性的get方法 | 包括get_id()、get_active_time()、get_user() |


**类方法**

| 类方法 | 描述 |
| :------ | :--- |
| static Session& CreateSession(User& user) | 创建session实例，需要传入用户实例的引用 |
| static Session* GetSessionPointer(const std::string& session_id) | 通过session_id获取session实例 |
| static bool EraseSessionByUser(const User& user) | 删除用户实例对应的session |
|  static void AsyncLoadFromDataBase() | 从数据库加载信息到STL容器（异步），以后获取信息就可以跳过数据库直接从内存获取 |
| static void WaitForReady() | 等待会话库就绪(和上面的方法成对，调用该方法会阻塞线程，直到已经从数据库加载完所需数据) |


具体代码略。

