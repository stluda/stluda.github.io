## 任务类

任务是一种特殊的查询，如果说普通的查询操作是静态的、一次性的话，那么任务查询则是动态的、持续性的查询。

经过一次查询，用户并不一定从现在的结果中能找到想要，那么系统允许基于这个查询创建持续性的查询任务，每当出现新职位的时候都会进行增量查询，直到找到想要的结果为止。



所以任务类的结构和查询结果类其实比较相似，都会储存查询结果。不同的是查询结果类的结果是静态的，而任务类的查询结果可能随时会增加。



具体属性和方法如下：

**实例属性：**

| 属性名称   | 类型  | 描述|
| :------ | :----- | :----- |
| id | int | 任务id |
| name | std::string | 任务名称(可由用户自定义) |
| query_expression_str | std::string | 查询表达式 |
| job_version_after | uint64_t | 只查询创建时间在这之后的的职位 |
| expire_time | Base::DateTime | 任务的失效时间（到达失效时间后，后台不再继续查询） |
| exist | bool | 任务是否存在（进行删除时，会将这个属性标记为false。下次重启程序时将不加载exist==false的任务，来间接达到删除的目的。这样可以解决一些同步问题） |
| query_result | std::vector<const Job*> | 查询结果 |
| user | User& | 所关联的用户的引用 |

**实例方法（针对某个具体任务的操作）：**

| 实例方法 | 描述 |
| :------ | :--- |
| 各属性的get方法 | 如get_id()、get_name()等等 |
| int do_query() | 对整个职位库范围进行查询，查询结果将自动添加到query_result中。返回值为所添加的查询结果的数目 |
| int do_query(const std::vector<const Job*>& job_pointer_list) | 和上面的方法不同点在于可以给定一个职位数组，在这个数组范围进行查询。返回值为所添加的查询结果的数目|

do_query()代码：
```C++
int Task::do_query()
{
	if (!m_exist) return -1;

	std::vector<const Job*> query_result;
	uint64_t version = Model::Job::Query(get_expression(), query_result, m_job_version_after);

	add_query_result(query_result,version);
	if (query_result.size()>0 && m_exist) m_user.notify_task_query_result_changed();
	return query_result.size();
}

int Task::do_query(const std::vector<const Job*>& job_pointer_list)
{
	if (!m_exist) return -1;

	std::vector<const Job*> query_result;

	uint64_t version = m_job_version_after;


	for (const Job* p_job : job_pointer_list)
	{
		if (version < p_job->get_version()) version = p_job->get_version();
		if (get_expression()->is_match(*p_job))
		{
			query_result.emplace_back(p_job);
		}
	}
	
	add_query_result(query_result,version);
	if (query_result.size()>0 && m_exist) m_user.notify_task_query_result_changed();
	return query_result.size();
}

void Task::add_query_result(const std::vector<const Job*>& query_result,uint64_t version)
{
	using namespace Base::Database;

	if (query_result.size() > 0)
	{
		//因为插入的是数组，所以要避免插入一半时出现意外导致数据残缺的情况，要将整个过程当做是一个原子操作对待
		MultiSqlTask *task = new MultiSqlTask;

		static const std::string kSql1("INSERT INTO tjh_task_queryresult_item(task_id,job_id,result_index) VALUES(?,?,?);");

		for (int i = 0, length = query_result.size(), offset = m_query_result.size(); i < length; i++)
		{
			task->emplace(SqlTaskType::DML, kSql1, m_id, query_result[i]->get_id(), offset + i);
		}

		static const std::string kSql2("UPDATE tjh_task_detail SET job_version_after=? WHERE task_id=?;");
		task->emplace(SqlTaskType::DML, kSql2, version, m_id);

		Common::DBManager::EnqueueMultiTask(SqlTaskPriority::Low, task);

		//如果有查询结果，则追加到已有结果当中
		{
			std::unique_lock<std::mutex> lock(m_mutex_data);
			m_query_result.insert(m_query_result.end(), query_result.begin(), query_result.end());
			//更新职位数据库版本，下次查询只查询在这个版本以后的职位
			m_job_version_after = version;
		}
	}
	else
	{
		std::unique_lock<std::mutex> lock(m_mutex_data);
		//更新职位数据库版本，下次查询只查询在这个版本以后的职位
		m_job_version_after = version;
	}
}
```



**类方法（针对整个任务库的操作）：**

| 类方法 | 描述 |
| :------ | :--- |
| static Task& Add(const std::string& task_name,User& user,const std::string& query_expression_str,uint64_t job_version_after,const Base::DateTime &expire_time) | 向整个任务库添加一个任务 |
| static Task* GetPointer(int id) | 通过任务id获取任务实例 |
| static bool ContainsKey(int id) | 判断是否存在该id的任务 |
| static void Erase(int id) | 删除任务（采用比较柔和的手段） |
| static std::vector<Task*> ForEach(const std::function<void(Task&)>& func) | 遍历所有任务执行特定操作 |
| static void SetTaskAddedCallBack(const std::function<void(Task& task)>& callback) | 注册任务添加事件的监听器，任务处理模块会调用此方法注册自身，这样每当有新任务时任务处理模块能够第一时间得知 |
|static void AsyncLoadFromDataBase() | 从数据库加载信息到STL容器（异步），以后获取信息就可以跳过数据库直接从内存获取 |
| static void WaitForReady() | 等待任务库就绪(和上面的方法成对，调用该方法会阻塞线程，直到已经从数据库加载完所需数据) |

代码：

```C++
Task& Task::Add(const std::string& task_name,
	User& user,
	const std::string& query_expression_str,
	uint64_t job_version_after,
	const Base::DateTime &expire_time)
{
	using Common::DBManager;
	using namespace Base::Database;


	std::unique_lock<std::mutex> lock_database(_mutex_task_database);
	Task& task = _task_map.emplace(std::piecewise_construct, std::forward_as_tuple(_new_task_id),
		std::forward_as_tuple(_new_task_id,task_name, user, query_expression_str, job_version_after, expire_time)).first->second;
	_task_pointer_list.emplace_back(&task);
	user.append_task(&task);
	lock_database.unlock();
	
	
	MultiSqlTask *sqlTask = new MultiSqlTask;

	static const std::string kSql1("INSERT INTO tjh_task_detail(task_id,task_name,user_name,query_expression,job_version_after,expire_time) VALUES(?,?,?,?,?,?);");
	sqlTask->emplace(SqlTaskType::DML, kSql1, _new_task_id,task_name, user.get_name(), query_expression_str, job_version_after, expire_time);

	_new_task_id++;

	static const std::string kSql2("UPDATE tjh_task_other SET new_task_id = ?");
	sqlTask->emplace(SqlTaskType::DML, kSql2, _new_task_id);


	Common::DBManager::EnqueueMultiTask(SqlTaskPriority::Low, sqlTask);
	
	//回调方法告知有新任务
	_task_added_callback(task);

	return task;
}

Task* Task::GetPointer(int id)
{
	auto it = _task_map.find(id);
	if (it != _task_map.end())
	{
		Task* ret = &it->second;
		return ret->m_exist ? ret : nullptr;
	}
	else
	{
		return nullptr;
	}
}

Task& Task::Get(int id)
{
	assert(ContainsKey(id));
	return *GetPointer(id);
}

void Task::Erase(int id)
{
	using Common::DBManager;
	using namespace Base::Database;
	Task* p_task = GetPointer(id);
	if (p_task != nullptr)
	{
		p_task->m_user.erase_task(p_task);
		p_task->m_exist = false;

		static const std::string kSql("DELETE FROM tjh_task_detail where task_id = ?;");
		Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSql, id);
	}

}

std::vector<Task*> Task::ForEach(const std::function<void(Task&)>& func)
{
	std::vector<Task*> task_pointer_list_clone;
	{
		std::unique_lock<std::mutex> lock(_mutex_task_database);
		task_pointer_list_clone = _task_pointer_list;
	}

	for (Task* p_task : task_pointer_list_clone)
	{
		if (p_task->m_exist) func(*p_task);
	}

	return task_pointer_list_clone;

}

void Task::AsyncLoadFromDataBase()
{
	using namespace Base::Database;
	using Common::DateHelper;

	static const std::string kSqlQueryTaskOther("SELECT new_task_id FROM tjh_task_other;");
	Common::DBManager::EnqueueDQLTask(SqlTaskPriority::Highest, [](const DQLSqlTask& task){
		deal_with_resultset_init(task, [](sql::ResultSet* res){
			if (res->next())
			{
				_new_task_id = res->getInt("new_task_id");
			}
			else
			{
				static const std::string kSql("INSERT INTO tjh_task_other(new_task_id) VALUES(?);");
				Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSql, _new_task_id);
			}
		});
	}, kSqlQueryTaskOther);


	//读取任务数据
	static const std::string kSqlQueryTaskDetail("SELECT task_id,task_name,user_name,query_expression,job_version_after,expire_time FROM tjh_task_detail;");
	Common::DBManager::EnqueueDQLTask(SqlTaskPriority::Highest, [](const DQLSqlTask& task){

		foreach_line_in_resultset_init(task, [](sql::ResultSet* res){
			int id = res->getInt("task_id");		
			//正常情况下id是不可能大于_new_task_id的，但为了防止人为修改数据库造成的异常情况，加个判断
			if (id > _new_task_id)_new_task_id = id;

			std::string user_name = res->getString("user_name");
			User* p_user = User::GetPointer(user_name);
			if (p_user != nullptr)
			{
				Task& task = _task_map.emplace(std::piecewise_construct, std::forward_as_tuple(id),
					std::forward_as_tuple(id, res->getString("task_name"), *p_user,
					res->getString("query_expression"),res->getUInt64("job_version_after"),
					DateHelper::ToDateTime(res->getString("expire_time")))).first->second;
				_task_pointer_list.emplace_back(&task);
				p_user->append_task(&task);					
			}
			else
			{
				G::LogOfProgram().error("增加任务信息时数据库异常，出现了不存在的user");
			}

			
		});

		for (int i = 0, length = _task_pointer_list.size(); i < length; i++)
		{
			static const std::string kSqlQueryTaskJobQueryResultDetail("SELECT job_id,result_index FROM tjh_task_queryresult_item where task_id = ? ORDER BY result_index;");

			Task& task = *_task_pointer_list[i];

			bool is_last = i == length - 1;
			Common::DBManager::EnqueueDQLTask(SqlTaskPriority::Highest, [is_last, &task](const DQLSqlTask& sqlTask){
				foreach_line_in_resultset_init(sqlTask, [&task](sql::ResultSet* res){
					int job_id = res->getInt("job_id");
					const Job* p_job = Job::GetPointer(job_id);
					if (p_job != nullptr)
					{
						task.m_query_result.emplace_back(p_job);
					}
					else
					{
						G::LogOfProgram().error("增加职位查询结果信息时数据库异常，出现了不存在的job");
					}
				});

				if (is_last)
				{
					_is_ready = true;
					_cond_ready.notify_one();//通知主线程整个查询任务已经结束
					G::LogOfProgram().info("Task库已完成初始化");
				}

			}, kSqlQueryTaskJobQueryResultDetail, task.m_id);
		}

	}, kSqlQueryTaskDetail);

}

void Task::WaitForReady()
{
	std::mutex mutex;
	std::unique_lock<std::mutex> lock(mutex);
	_cond_ready.wait(lock, [](){ return _is_ready; });
}

```