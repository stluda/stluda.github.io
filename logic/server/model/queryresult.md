## 查询结果类

由于查询结果数目可能很多，服务器一次性将结果全部返回给客户端信息量太大，对双方都是一种负担 。
本项目采用的解决方法是将查询结果直接存储下来并分页，每次客户端请求时只返回部分查询结果。但限制每个用户同时允许持有的查询结果实例，每个用户最多同时进行3个查询。

本类存储查询结果的相关信息，包括查询结果的id、查询结果里的职位指针等等。

具体属性和方法如下：



**实例属性：**

| 属性名称   | 类型  | 描述|
| :-------- | :----- | :----- |
| id | std::string | 每个查询结果创建时随机生成的字符串。通过这个id来定位查询结果的实例 |
| query_no | int | 每个用户最多同时拥有3个查询，再多的话就只能删除旧查询后再创建新的。这个属性表示它所占有的是用户的哪个查询，其取值范围为0~2 |
| query_expression_str | std::string | 创建查询时所使用的查询表达式 |
| version | uint64_t | 进行查询的那一刻，职位库的版本（最后一次创建职位的时间）。 由于查询任务是在现有查询结果的基础上创建的，这个值将会成为新旧职位的分界线。一个职位的版本(创建时间)比它新的话，会被视为是新职位，反之视为旧职位。 |
| user | User& | 所持有的用户的引用，表示它是由哪位用户发起的查询结果。 |
| datas | std::vector<const Job*> | 查询结果，类型为职位类实例指针所组成的数组 |

**实例方法（针对某个具体查询结果的操作）：**

| 实例方法 | 描述 |
| :------ | :--- |
| 各属性的get方法 | 如get_id()、get_query_no()等 |

**类方法（针对整个查询结果库的操作）：**

| 类方法 | 描述 |
| :------ | :--- |
|static JobQueryResult& Add(User& user, int query_no,const std::string& query_expression_str, const std::vector<const Job*>& datas, uint64_t version) | 查询完成后，将查询结果加入到查询结果库中 |
| static JobQueryResult* GetPointer(const std::string& id) | 通过id获取查询结果 |
| static bool ContainsKey(const std::string& id) | 判断是否存在该id对应的查询结果 |
| static void Erase(const std::string& id) | 删除查询结果 |
| static bool Use(const std::string& id, const std::function<void(JobQueryResult*)>& func) | 通过id，使用某个具体的查询结果实例，执行过程中可以保证该实例绝对安全。若id不存在则返回false。 |

这里和职位类相比多了个特殊的方法Use，这是因为跟职位类不提供删除(Erase)方法不同，查询结果随时有可能会被删除。因此通过GetPointer()获得的指针其实是不安全的，如果实例被删除，那个指针会变成野指针，进而可能引发不可预知的后果。



因此引入这个方法，它能够保证执行Use()的过程，查询结果的实例不会被删除。



举个例子，以下为请求处理模块收到创建查询任务的请求，在通过现有查询结果创建任务并填充响应数据时的代码：

```C++
Model::JobQueryResult::Use(query_id, [task_name,p_session,expire_time,&p_task](Model::JobQueryResult* result){
						uint64_t version_after = result->get_version();
						p_task = &Model::Task::Add(task_name, p_session->get_user(), result->get_query_expression_str(), version_after, expire_time);
					})){
						auto& task = *p_task;
						auto* p_task_proto = response.add_task_list();

						p_task_proto->set_id(task.get_id());
						p_task_proto->set_username(task.get_user().get_name());
						p_task_proto->set_query_expression(task.get_query_expression_str());
						p_task_proto->set_taskname(task.get_task_name());
						p_task_proto->set_expire_time(Common::DateHelper::ToString(task.get_expire_time()));
						p_task_proto->set_query_result_count(task.get_query_result_count());

						response.set_error_code(TencentJobHunterMessage::ErrorCode::SUCCESS);
					}
```

将具体业务逻辑代码放进Use里，可以保证代码执行途中，查询结果的实例不会被删除。



Use()和Erase()的具体实现如下：

```C++
void JobQueryResult::Erase(const std::string& id)
{
	using Common::DBManager;
	using namespace Base::Database;

	JobQueryResult* p_result = GetPointer(id);
	

	if (p_result != nullptr)
	{


		//因为删除的是数组，所以要避免语句执行一半被中断而出现意外导致数据残缺的情况，要将整个过程当做是一个原子操作对待
		MultiSqlTask *task = new MultiSqlTask;

		static const std::string kSql1("DELETE FROM tjh_queryresult_item WHERE query_id = ?;");
		task->emplace(SqlTaskType::DML, kSql1, id);

		static const std::string kSql2("DELETE FROM tjh_queryresult WHERE query_id = ?;");
		task->emplace(SqlTaskType::DML, kSql2, id);

		Common::DBManager::EnqueueMultiTask(SqlTaskPriority::Low, task);

		//解决别处使用指针时，因为对象被销毁导致的野指针问题
		//这里使用条件变量，确保没有其他线程在用对象时才删除


        //静态容器锁上锁
		std::lock_guard<std::mutex> database_lock(_mutex_database);
        //给需删除的实例上锁
        std::lock_guard<std::mutex> instance_lock(p_result->m_mutex);
        
		p_result->m_user.set_query_result(nullptr, p_result->get_query_no());
		_result_map.erase(id);

	}
}
bool JobQueryResult::Use(const std::string& id, const std::function<void(JobQueryResult*)>& func)
{	
    //静态容器锁上锁
	std::unique_lock<std::mutex> database_lock(_mutex_database);
	
	auto it = _result_map.find(id);

	JobQueryResult* p = nullptr;
	if (it != _result_map.end())
	{
p = &it->second;
	}
	
	if (p == nullptr)return false;

    {        
    	std::lock_guard<std::mutex> instance_lock(p->m_mutex);//给需访问的实例上锁
        database_lock.unlock();//静态容器锁解锁
		func(p);
    }

	return true;
}
```

这里的同步使用了2个锁，一个锁用来保证_result_map（储存查询结果实例的静态容器）的线程安全，这个锁是静态锁。另一个用来保证实例本身的安全，为实例里的成员锁（防止使用实例指针的过程中实例被销毁）

其实只用一个静态锁也可以，但会造成一定程度的浪费，因为Use()在搜索完静态容器后得到实例的指针，开始执行内部方法时静态容器已经是安全的了，只是不能删除Use正在引用的实例而已。多引入一个实例锁的话，Use()在执行内部方法时其他方法就能访问静态容器了。



Add方法：

```C++
JobQueryResult& JobQueryResult::Add(User& user, int query_no,
	const std::string& query_expression_str, const std::vector<const Job*>& datas, uint64_t version)
{
	using Common::DBManager;
	using namespace Base::Database;

	std::string id = _GetRandomID();


	std::unique_lock<std::mutex> lock(_mutex_database);

	JobQueryResult& result = _result_map.emplace(std::piecewise_construct, std::forward_as_tuple(id),
		std::forward_as_tuple(id, user, query_no, query_expression_str, version)).first->second;
	result.m_datas = datas;

	user.set_query_result(&result, query_no);

	lock.unlock();

	//以下为数据库操作

	//因为插入的是数组，所以要避免插入一半时出现意外导致数据残缺的情况，要将整个过程当做是一个原子操作对待
	MultiSqlTask *task = new MultiSqlTask;

	static const std::string kSql1("DELETE FROM tjh_queryresult_item WHERE query_id IN (SELECT query_id FROM tjh_queryresult WHERE user_name = ? AND query_no = ?);");
	task->emplace(SqlTaskType::DML, kSql1, user.get_name(), query_no);

	static const std::string kSql2("DELETE FROM tjh_queryresult WHERE user_name = ? AND query_no = ?;");
	task->emplace(SqlTaskType::DML, kSql2, user.get_name(), query_no);

	static const std::string kSql3("INSERT INTO tjh_queryresult(query_id,user_name,query_no,query_expression,version) VALUES(?,?,?,?,?);");
	task->emplace(SqlTaskType::DML, kSql3, id, user.get_name(), query_no, query_expression_str,version);

	static const std::string kSql4("INSERT INTO tjh_queryresult_item(query_id,job_id,result_index) VALUES(?,?,?);");
	for (int i = 0, length = datas.size(); i < length; i++)
	{
		task->emplace(SqlTaskType::DML, kSql4, id, datas[i]->get_id(),i);
	}

	Common::DBManager::EnqueueMultiTask(SqlTaskPriority::Low, task);

	return result;
}
```

查询结果类的Add方法相比其他实体管理类区别在于数据库操作上面。由于查询结果会有多条记录，一条一条插入的话，如果作业进行到一半出现什么意外事故被中断，那么就会有数据残缺的情况。

因此要么做，要么不做，这里将整个数据库操作封装成一个事务，确保整个过程的原子性。



其他方法略。