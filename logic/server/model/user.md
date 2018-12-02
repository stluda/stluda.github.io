## 用户类

本类的实例除了存储用户的基本信息，如用户名、密码、邮箱等之外，还会保存和用户关联的其他实体类的id或引用，包括会话类的id、查询结果类的引用和任务类的引用。

属性和方法如下：

**实例属性：**

|属性名称|类型|描述|
|:-----|:-----|:------ |
| name | std::string|用户名|
| pass | std::string | 密码(密文，MD5+盐) |
| salt | std::string | 盐，参与生成MD5密文，在用户创建时随机生成 |
| email | std::string | 邮箱 |
| verify | int | 注册时产生的验证码（此功能目前暂时未实现） |
| is_activated | bool | 账号是否已激活（此功能目前暂时未实现） |
| session | std::string | session的id，每个用户同一时间只会有一个session |
| job_query_results | JobQueryResult*[3] | 查询结果的指针数组（每个用户最多允许同时保留3个查询结果） |
| tasks | std::vector<Task*> | 任务指针数组 |
| task_query_result_changed_time | uint64_t | 当用户所持有的任务有新的查询结果时，会更新这个时间。 这个值可以用来判断某个用户的任务是否有新的查询结果。 |

**实例方法（针对某个具体用户的操作）：**

| 实例方法 | 描述 |
| :------ | :------ |
| 各属性的get方法 | 如get_name()、get_pass()等等 |
| void set_session(const std::string& session) | 用户登录以后会调用这个方法，更新与用户绑定的session_id。每个用户同一时间只会有一个session_id |
| void set_query_result(JobQueryResult* result, int index) |  请求响应模块在收到查询请求，查询结束得到查询结果后，会将查询结果在用户实例中也保留一份指针。 当查询结果被删除时，则调用set_query_result(nullptr,index)表示该位置可以创建新查询。（每个用户最多同时保留3个查询结果）|
| JobQueryResult* get_query_result(int index) const | 获取查询结果。若index位置没有查询结果则返回nullptr |
| void set_query_result_info_proto(JobQueryResultInfo* info) | 将查询结果的信息输出到protobuf对象中（服务端在响应客户端请求时会用到） |
| void append_task(Task* task_pointer) | 请求响应模块在收到添加任务请求，创建了任务对象后，会调用此方法，在对应的用户实例中也保存一份指针。 |
| bool erase_task_at(int index) | 当任务被删除时，同时删除关联用户所持有的指针 |
| bool erase_task(Task* task_pointer) | 同上 |
| Task* get_task_at(int index) | 获取某个位置的任务指针 |
| int get_task_count() | 获取该用户拥有的任务的数量 |
| uint64_t get_task_query_result_changed_time() | 获取上次用户持有的任务有新结果时的时间|
| uint64_t notify_task_query_result_changed() | 当用户所持有的任务有新查询结果时调用此方法更新时间 |


**类方法（针对整个用户库的操作）：**

| 类方法 | 描述 |
| :------ | :--- |
| static User& Add(const std::string& name,const std::string& pass,const std::string& salt,const std::string& email,int verify) | 向用户库添加一个新用户 |
| static bool ContainsKey(const std::string& name) | 判断用户是否存在 |
| static User* GetPointer(const std::string& name) | 通过用户名得到用户对象，若用户不存在则返回nullptr |
|  static void AsyncLoadFromDataBase() | 从数据库加载信息到STL容器（异步），以后获取信息就可以跳过数据库直接从内存获取 |
| static void WaitForReady() | 等待用户库就绪(和上面的方法成对，调用该方法会阻塞线程，直到已经从数据库加载完所需数据) |



具体代码比较简单，各种增删查改操作跟[职位类](logic/server/model/job.md)大同小异，这里就不再另外放出来了。