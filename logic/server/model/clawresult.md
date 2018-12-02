## 抓取结果类

这个类用来存放职位抓取模块(爬虫模块)的抓取状态和结果，从而给职位抓取模块提供中断续做等功能。
它和其他实体类比起来比较特殊，它最多只会有两个实例，一个实例存放现在正在进行的抓取作业的状态，另一个实例存放上次进行的抓取作业的结果。

属性和方法如下：

**实例属性：**

| 属性名称 | 类型  | 描述|
| :------ | :----- | :----- |
| job_id_set | std::set<int> | 抓取到的职位的id |
| is_working | bool | 是否正在进行抓取作业 |
| begin_time | Base::DateTime | 开始抓取作业的的时间 |
| is_special | bool | 是否为特殊抓取任务 |
| first_list_page_hash | uint64_t | 抓取到的列表页的第一页的html的hash值。每次要开始抓取任务前，会判断上次抓取结果的这个值和这次得到的hash值是否一致。若一致说明列表页第一页内容没发生变化，则不进行抓取作业 |
| claw_start_date | Base::Date | 抓取范围的起始日期(包含当天) |
| claw_target_date | Base::Date | 抓取范围的结束日期(包含当天) |
| claw_current_date | Base::Date | 表示正在抓取哪一天发布的职位 |
| first_list_page_first_date | Base::Date | 列表页第1页第1个职位的发布日期 |
| first_list_page_last_date | Base::Date | 列表页第1页最后一个职位的发布日期 |
| current_clawing_index | int | 表示当前抓取到列表页的职位的索引(从0开始，每10个为1页) |
| total_detail_parse_count | int | 一共解析了多少次详情页 |
| total_detail_parse_errors | int | 解析详情页失败的总次数 |
| total_network_errors | int | 发生网络错误的总次数 |
| total_parse_errors | int | 解析html失败的总次数 |
| map_item_index_by_date | std::unordered_map<int, int> | 这个map表示第1次出现给定日期发布的职位在列表页中的索引。它的key是发布日期的时间戳。|


如表格所示，抓取结果类的属性提供了爬虫工作所需的各种信息，爬虫模块进行作业的途中会更新这些属性，而当程序意外中断时，下次启动时也可以凭借这些信息还原工作的现场。



**实例方法** 

只有各属性的get和set方法，略过。



**类方法**

| 类方法 | 描述 |
| :------ | :--- |
| static void CommitInitInfo() | 抓取作业开始时会调用此方法，将抓取作业的初始化信息提交到数据库 |
| static void CommitStatus() | 将目前抓取到的信息提交到数据库 |
| static JobClawResult& GetCurrentClawResult() | 获取当前抓取作业的抓取结果类实例 |
| static const JobClawResult& GetLastClawResult() | 获取上次抓取作业的抓取结果类实例（因为结果已确定因此是只读的）|
| static void SaveCurrentResult() | 在抓取作业结束后调用，将会将"当前"结果移动到"上次"结果覆盖，然后清空本次作业的结果，将is_working状态置为false |
| static void PutIntoJobSet(int id) | 将抓取到的职位的id放入抓取结果中 |
| static void SetItemIndexOfDate(const Base::Date& date, int item_index) | 此方法用来更新map_item_index_by_date，表示第一次出现某个日期发布的职位于列表页的索引 |
| static bool GetLastResultOfItemIndexOfDate(const Base::Date& date, int& item_index) | 此方法用来获取上次抓取结果中，第一次出现某个日期发布的职位于列表页的索引，该方法的意义在于那上次的结果来预测本次的结果。 |
| static bool IfJobInfoUpdated() | 开始抓取作业时调用，会比较这次抓取和上次抓取的first_list_page_hash(列表页第1页html的hash值)，若两个值相同代表列表页没发生变化，则跳过本次抓取作业 |
| static void AsyncLoadFromDatabase() | 从数据库加载信息到STL容器（异步），以后获取信息就可以跳过数据库直接从内存获取 |
| static void WaitForReady() |等待抓取结果库就绪(和上面的方法成对，调用该方法会阻塞线程，直到已经从数据库加载完所需数据) |



代码：

```C++
void JobClawResult::CommitInitInfo()
{
	using namespace Base::Database;
	static const std::string kSql("UPDATE tjh_clawresult_detail SET "
		"claw_start_date=?,claw_target_date=?,first_list_page_hash=?,is_special=?,begin_time=?,"
		"total_detail_parse_count=0,total_detail_parse_errors=0,total_network_errors=0,total_parse_errors=0 "
		"WHERE claw_id=0;");
	JobClawResult& c = _claw_result_curr;
	Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSql,
		c.m_claw_start_date, c.m_claw_target_date,c.m_first_list_page_hash,c.m_is_special,c.m_begin_time
		);
}

void JobClawResult::CommitStatus()
{
	using namespace Base::Database;
	static const std::string kSql("UPDATE tjh_clawresult_detail SET claw_current_index=?,claw_current_date=?,"
		"total_detail_parse_count=?,total_detail_parse_errors=?,total_network_errors=?,total_parse_errors=?,is_working=1 "
		"WHERE claw_id=0;");
	JobClawResult& c = _claw_result_curr;
	Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSql,
		c.m_current_clawing_index, c.m_claw_current_date,
		c.m_total_detail_parse_count, c.m_total_detail_parse_errors, c.m_total_network_errors, c.m_total_parse_errors
	);
}

//将此次的抓取结果保存到数据库，并记录上次结果
void JobClawResult::SaveCurrentResult()
{
	JobClawResult &c = _claw_result_curr, &l = _claw_result_last;
	bool is_hash_equal = l.m_first_list_page_hash == c.m_first_list_page_hash;
	if (is_hash_equal)
	{
		//职位信息未发生变动，那么两个map可以进行合并操作
		for (auto pair : c.m_map_item_index_by_date)
		{
			if (!Common::ContainerHelper::Contains(l.m_map_item_index_by_date, pair.first))
			{
				l.m_map_item_index_by_date.emplace(pair.first, pair.second);
			}
		}
	}
	else
	{
		//职位信息已发生变动，上次的结果已过期，直接覆盖
		l.m_map_item_index_by_date = c.m_map_item_index_by_date;
	}

	l.m_first_list_page_hash = c.m_first_list_page_hash;
	l.m_current_clawing_index = c.m_current_clawing_index;
	l.m_total_detail_parse_count = c.m_total_detail_parse_count;
	l.m_total_detail_parse_errors = c.m_total_detail_parse_errors;
	l.m_total_network_errors = c.m_total_network_errors;
	l.m_total_parse_errors = c.m_total_parse_errors;
	l.m_claw_start_date = c.m_claw_start_date;
	l.m_claw_target_date = c.m_claw_target_date;
	l.m_claw_current_date = c.m_claw_current_date;
	l.m_is_working = c.m_is_working;
	l.m_begin_time = c.m_begin_time;
	l.m_is_special = c.m_is_special;

	c.m_total_detail_parse_count = 0;
	c.m_total_detail_parse_errors = 0;
	c.m_total_network_errors = 0;
	c.m_total_parse_errors = 0;
	c.m_is_working = false;
	c.m_is_special = false;
	c.m_map_item_index_by_date.clear();
	c.m_job_id_set.clear();

	//将结果写入数据库
	using namespace Base::Database;
	static const std::string kSql1("DELETE FROM tjh_clawresult_detail WHERE claw_id=1;");
	static const std::string kSql2("UPDATE tjh_clawresult_detail SET claw_id=1,is_working=0 WHERE claw_id=0;");
	static const std::string kSql3("INSERT INTO tjh_clawresult_detail(claw_id,is_working) VALUES(0,0);");
	//因为这必须是一个原子操作，要么做要么不做，所以将5个操作组成一个事务
	MultiSqlTask *task = new MultiSqlTask;
	task->emplace(SqlTaskType::DML, kSql1);
	task->emplace(SqlTaskType::DML, kSql2);
	task->emplace(SqlTaskType::DML, kSql3);

	if (is_hash_equal)
	{
		static const std::string kSql4("DELETE t1.* FROM tjh_clawresult_dateinfo AS t1 "
			"INNER JOIN tjh_clawresult_dateinfo AS t2 "
			"ON t1.claw_id!=t2.claw_id AND t1.job_date=t2.job_date "
			"WHERE t1.claw_id=0;");
		task->emplace(SqlTaskType::DML, kSql4);//先去重,再更新
	}
	else
	{
		static const std::string kSql4("DELETE FROM tjh_clawresult_dateinfo WHERE claw_id=1;");
		task->emplace(SqlTaskType::DML, kSql4);
	}

	static const std::string kSql5("UPDATE tjh_clawresult_dateinfo SET claw_id=1 WHERE claw_id=0;");
	task->emplace(SqlTaskType::DML, kSql5);

	if (l.m_is_special)
	{
		static const std::string kSql6("DELETE FROM tjh_clawresult_joblist;");//抓取完成后这个清单就用不上了，清空
		task->emplace(SqlTaskType::DML, kSql6);

		_last_special_time = _claw_result_last.m_begin_time;
		_last_special_first_list_page_hash = _claw_result_last.m_first_list_page_hash;
		static const std::string kSql7("UPDATE tjh_clawresult_last_special_info SET last_special_time=?,first_list_page_hash=?;");
		task->emplace(SqlTaskType::DML, kSql7, _last_special_time, _last_special_first_list_page_hash);
	}

	Common::DBManager::EnqueueMultiTask(SqlTaskPriority::Normal,task);
}

void JobClawResult::PutIntoJobSet(int id)
{
	using namespace Base::Database;
	if (!Common::ContainerHelper::Contains(_claw_result_curr.m_job_id_set, id))
	{
		_claw_result_curr.m_job_id_set.emplace(id);
		static const std::string kSql("INSERT INTO tjh_clawresult_joblist(job_id) VALUES(?);");
		Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSql, id);
	}
}

//保存职位信息的抓取结果，下次抓取时就可以用本次结果来进行预测
void JobClawResult::SetItemIndexOfDate(const Base::Date& date, int item_index)
{
	int date_hash = Common::DateHelper::ToInt(date);		
	if (!Common::ContainerHelper::Contains(_claw_result_curr.m_map_item_index_by_date, date_hash))
	{
		_claw_result_curr.m_map_item_index_by_date.emplace(date_hash, item_index);
		Global::LogOfClawer().info(fmt("职位的日期[%1%]于第%2%个职位中首次出现") % Common::DateHelper::ToString(date) % (item_index+1));

		using namespace Base::Database;
		static const std::string kSql("INSERT INTO tjh_clawresult_dateinfo(claw_id,job_date,item_index) VALUES(0,?,?);");
		Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSql, date, item_index);
	}
}

bool JobClawResult::GetLastResultOfItemIndexOfDate(const Base::Date& date, int& item_index)
{
	if (IfJobInfoUpdated())return false;//如果页面发生变动，那么上次的结果已经失效，不再具有参考意义
	
	int date_hash = Common::DateHelper::ToInt(date);
	auto it = _claw_result_last.m_map_item_index_by_date.find(date_hash);
	
	if (it != _claw_result_last.m_map_item_index_by_date.end())
	{
		item_index = it->second;
		return true;
	}
	return false;		
}

bool JobClawResult::IfJobInfoUpdated()
{
	return _claw_result_curr.m_first_list_page_hash == 0 || _claw_result_curr.m_first_list_page_hash != _claw_result_last.m_first_list_page_hash;
}

void JobClawResult::AsyncLoadFromDatabase()
{
	using namespace Base::Database;
	using Common::DateHelper;
	using Base::Date;

	static const std::string kSqlQueryClawResultDateInfo("SELECT * FROM tjh_clawresult_dateinfo;");
	Common::DBManager::EnqueueDQLTask(SqlTaskPriority::Highest, [](const DQLSqlTask& task){
		foreach_line_in_resultset_init(task, [](sql::ResultSet* res){
			JobClawResult& claw_result = res->getInt("claw_id")==0 ? _claw_result_curr : _claw_result_last;
			claw_result.m_map_item_index_by_date.emplace(DateHelper::ToInt(DateHelper::ToDate(res->getString("job_date").c_str())), res->getInt("item_index"));
		});
	}, kSqlQueryClawResultDateInfo);


	static const std::string kSqlQueryClawResultLastSpecialTimeInfo("SELECT * FROM tjh_clawresult_last_special_info;");
	Common::DBManager::EnqueueDQLTask(SqlTaskPriority::Highest, [](const DQLSqlTask& task){
		deal_with_resultset_init(task, [](sql::ResultSet* res){
			if (res->next())
			{
				_last_special_time = DateHelper::ToDateTime(res->getString("last_special_time"));
				_last_special_first_list_page_hash = res->getUInt64("first_list_page_hash");
			}
			else
			{
				static const std::string kSqlInsertDefaultClawLastSpecialTime
					("INSERT INTO tjh_clawresult_last_special_info(last_special_time,first_list_page_hash) VALUES(?,0)");
				Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSqlInsertDefaultClawLastSpecialTime, _last_special_time);
			}
		});
	}, kSqlQueryClawResultLastSpecialTimeInfo);

	static const std::string kSqlQueryClawResultJobList("SELECT job_id FROM tjh_clawresult_joblist;");
	Common::DBManager::EnqueueDQLTask(SqlTaskPriority::Highest, [](const DQLSqlTask& task){
		foreach_line_in_resultset_init(task, [](sql::ResultSet* res){
			_claw_result_curr.m_job_id_set.emplace(res->getInt("job_id"));
		});
	}, kSqlQueryClawResultJobList);

	static const std::string kSqlQueryClawResult("SELECT * FROM tjh_clawresult_detail;");
	Common::DBManager::EnqueueDQLTask(SqlTaskPriority::Highest, [](const DQLSqlTask& task){
		deal_with_resultset_init(task, [](sql::ResultSet* res){
			bool curr_result_exists = false, last_result_exists = false;
			JobClawResult* p_claw_result;
			while (res->next())
			{
				switch (res->getInt("claw_id"))
				{
				case 0:
					p_claw_result = &_claw_result_curr;
					curr_result_exists = true;
					break;
				case 1:
					p_claw_result = &_claw_result_last;
					last_result_exists = true;
					break;
				default:
					continue;
				}
				p_claw_result->m_current_clawing_index = res->getInt("claw_current_index");
				p_claw_result->m_claw_start_date = DateHelper::ToDate(res->getString("claw_start_date"));
				p_claw_result->m_claw_target_date = DateHelper::ToDate(res->getString("claw_target_date"));
				p_claw_result->m_claw_current_date = DateHelper::ToDate(res->getString("claw_current_date"));
				p_claw_result->m_first_list_page_hash = res->getUInt64("first_list_page_hash");
				p_claw_result->m_total_detail_parse_count = res->getInt("total_detail_parse_count");
				p_claw_result->m_total_detail_parse_errors = res->getInt("total_detail_parse_errors");
				p_claw_result->m_total_network_errors = res->getInt("total_network_errors");
				p_claw_result->m_total_parse_errors = res->getInt("total_parse_errors");
				p_claw_result->m_is_special = res->getBoolean("is_special");
				p_claw_result->m_is_working = res->getBoolean("is_working");
				p_claw_result->m_begin_time = DateHelper::ToDateTime(res->getString("begin_time"));
			}
			static const std::string kSqlInsertClawResult("INSERT INTO tjh_clawresult_detail(claw_id,is_special,is_working) VALUES(?,?,?);");
			if (!curr_result_exists)
			{
				Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSqlInsertClawResult, 0, false, false);
			}
			if (!last_result_exists)
			{
				Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSqlInsertClawResult, 1, false, false);
			}
		});
		_is_ready = true;
		_cond_ready.notify_one();
	}, kSqlQueryClawResult);
}

void JobClawResult::WaitForReady()
{
	if (_is_ready)return;
	std::mutex mutex;
	std::unique_lock<std::mutex> lock(mutex);
	_cond_ready.wait(lock);
}
```

