## 职位类

本类存储职位相关信息，包括职位的id、标题、类别、工作地点等。

职位相关的操作，包括增加职位、修改职位信息、获取职位、查询职位等等方法，也都被整合在这个类里。

具体属性和方法如下：

**实例属性：**

| 属性名称   | 类型  | 描述|
| :-------- | :----- | :----- |
| id | int | 职位详情页URL里的id，如https://hr.tencent.com/position_detail.php?id=45251，ID是45251 |
| title | std::string | 职位的标题 |
| type | int | 职位的类别，如技术类、市场类等。类型映射为数字方便保存 |
| location | int | 工作地点，如深圳、北京等。类型映射为数字方便保存 |
| hiring_number | int | 招聘人数 |
| date | Base::Date | 发布日期 |
| duties | std::string | 职位详情页里的工作职责 |
| requirements | std::string | 职位详情页里的工作要求 |
| version | uint64_t | 版本号，其值为职位信息的最新更新时间的毫秒数。可以利用这个值来判断哪些职位时新职位。 |
| is_full | bool | 职位信息是否完整。职位对象创建的顺序是先通过列表页创建基本信息，再访问详情页补全详细信息。只有当这个值为true时才能确保职位信息是完整的 |
| is_available | bool | 职位信息是否有效。如果在招聘网上已经找不到该职位，后台程序不会直接删除该职位信息，而是将这个值置为false，意为职位已失效，不再是被查询的对象 |


**实例方法（针对某个具体职位的操作）：**

| 实例方法 | 描述 |
| :------ | :--- |
| 各属性的get方法 | 如get_id()、get_title()等等 |
| uint64_t category_code() | 由工作地点，职位类型用特定算法复合而成的职位分类码。如果两个职位的这个值相同，说明它们的工作地点、职位类型都是相同的。利用这个数值可以比较方便的给职位数据分组 |

可以看到实例方法比较少。这里我没有提供set方法，其实是被我整合到类方法里面去了，比如说``static bool SetDetail(int id,const std::string &duties,const std::string &requirements)``。


**类方法（针对整个职位库的操作）：**

| 类方法 | 描述 |
| :------ | :--- |
| static Job& Add( int id, const std::string &title,const std::string &type,int hiring_number,const std::string &location,const Base::Date &date) | 添加职位信息，返回职位对象的引用（从列表页添加不包含工作职责和工作要求） |
| static bool SetDetail(int id,const std::string &duties,const std::string &requirements) | 补全职位的详细信息（职责、要求）。由于首次创建职位信息是从列表页进行的，因此缺失了详情页才有的工作职责和工作要求的信息。该方法用来从详情页补全信息 |
| static Job& Get(int id) | 根据职位id获取职位对象，返回的是引用，必须是存在的id不然会导致不可预料的错误 |
| static Job* GetPointer(int id) | 同上，区别是返回的是指针，id可以不存在，不存在的话返回nullptr |
| static bool ContainsKey(int id) | 给定一个id，判断是否存在该id对应的职位 |
|static void AsyncLoadFromDataBase() | 从数据库加载信息到STL容器（异步），以后获取信息就可以跳过数据库直接从内存获取 |
| static void WaitForReady() | 等待职位库就绪(和上面的方法成对，调用该方法会阻塞线程，直到已经从数据库加载完所需数据) |
| static void ForeachJob(const std::function<void(Job&)>& func) | 遍历职位库里的所有职位，进行自定义操作 |
| static uint64_t ForeachJobReadonly(const std::function<void(const Job&)>& func, uint64_t version_after)| 遍历职位库里的所有职位，进行自定义操作，和上面的方法区别在于它只允许只读操作，对于只读操作来说效率会更高一点。返回值为职位库的版本 |
| static void SetIsAvailable(int job_id, bool state) | 设置职位是否有效。若发现一个职位已经从腾讯招聘网中移除，程序会调用这个方法将职位标记为失效职位。 |
| int SetUnavailableDiffernce(const std::set<int>& job_id_set) | 给定一个职位id的set（通常是从腾讯招聘网）遍历列表页得到的所有职位的id，该方法会将所有库里存在而set里不存在的职位找出来，将它们标记为"已失效"。通常用来批量整理已失效职位 |
| static bool IsJobInfoComplete(const Base::Date& date) | 判断某一天的职位信息是否齐全（供爬虫模块使用，若判断为齐全则可以跳过所有该发布日期的职位） |
| static void NotifyJobDateInfoFull(const Base::Date& date) | 和上面的方法相对。爬虫模块在发现某一天发布的所有职位都已入库后，调用该方法告诉职位库该日期的职位库已完整（该日期不会再有新增加的职位）|
| static uint64_t GetLatestVersion() | 获取最新创建的职位的创建时间(版本号) |
| static std::shared_ptr<JobDetailQueryExpression> Query(const std::string& query_exp_str, std::vector<const Model::Job*>& result) throw std::string | 查询操作，通过查询表达式字符串得到职位列表，返回值为查询表达式对象。若表达式有误会抛出异常 |
| static uint64_t Query(const std::shared_ptr<JobDetailQueryExpression>& query_exp,std::vector<const Model::Job*>& result, uint64_t version_after) throw std::string| 也是查询操作，和上面的方法的区别是允许指定一个版本号，只查询那个版本号之后的职位（通常用来做新职位的增量查询），返回值为整个职位库当前的最新版本 |
| static void SetJobAvailableCallBack(const std::function<void(Job& job)>& callback) | 注册新职位可用时的回调方法，目前只有任务处理模块会用到。当新职位可用（已从详情页补全数据时），会调用注册的回调方法，如通知任务处理模块有新职位。 |



可以看到，其实这个职位库提供了大部分的核心方法，包括增删改，获取详情和表达式查询，供程序的各模块使用。（因为职位信息会被很多其他数据引用，如查询结果等，直接删除会造成很多问题，因此舍弃了删除，改为较为柔和的"标记为不可用"方法）

这里解释一下版本号，这个每个职位都有，其实就是本地数据创建或更新的时间。为什么引入这个东西，是为了区分旧职位和新职位。因为腾讯招聘网职位的发布日期是有可能改变的，通过发布日期来判断职位的新旧不是很靠谱。

而所谓的新旧其实都是相对于某个时间点而言的。比如说我在某个时间点进行了查询操作，发现没有自己想要职位，那么就可以以该时间点为基准，所有创建时间在这之后的职位都视作是新职位，那么用户发布的自动查询任务，就可以跳过所有创建时间比该时间点早的旧职位，然后每次查询完后更新整个职位库的最新创建时间，即最新版本，就能保证每次查询都是对新职位的增量查询，避免无谓的重复查询。



**专用容器**

前面已经说过，为了提高操作效率，增删查改并不直接操作数据库，而是操作内存里的容器，然后再将具体更改异步提交到数据库。

那么问题来了，应该选用什么样的容器？

容器首选自然是强大的STL容器。

但是，对职位的操作因为比较复杂，不止是增删改，还有基于查询表达式的高级查询，只用一个map或一个vector来储存明显不太够，需要多个STL容器配合来满足各种需求，STL容器太多的话，代码会显得杂乱，因此对于职位类特别做了一个复合容器类``JobContainer``：

| 方法 | 描述 |
| :------ | :--- |
| Job& emplace(int id,Args&&... args) | 添加职位信息到容器。这里使用了可变模版参数，具体应传入的参数根据Job类的构造方法而定 |
| Job* get_pointer(int id) | 根据id获取Job指针 |
| uint64_t get_version() | 获取整个职位库的版本(最新创建/更新职位的时间) |
| bool contains(int id) | 给定一个职位id，判断库中是否包含该职位 |
| void get_difference(const std::set<int>& job_id_set, std::list<Job*>& list) |求库中职位清单和给定职位清单(job_id_set)的差集，结果输出到list中 |
| void notify_job_full(Job& job) | 标记某个职位信息已补全（已访问过详情页） |
| void foreach_job(const std::function<void(Job&)>& func, bool include_invalid_job) | 对库中所有职位执行特定操作 |
| void foreach_job_of_not_full(const std::function<void(Job&)>& func, bool include_invalid_job) | 对库中所有信息不完整(未访问过详情页)的职位执行特定操作。（通常给爬虫程序使用，用来补全信息残缺的职位的数据） |
| uint64_t foreach_job_by_version(const std::function<void(const Job&)>& func,uint64_t version_after) const | 对库中版本号在version_after之后的所有职位执行特定操作(只读)，返回值为当前职位库的版本  |



容器类内部用到的STL容器

```C++
std::unordered_map<int, Job> _job_map;//该map保存职位信息，key为职位的id，职位的实体对象存储在该map中
std::unordered_map<int64_t, std::unordered_set<Job*>> _job_pointer_set_group_by_category_code;//存储Job指针，按职位分类码将职位数据进行分类
std::set<Job*, JobPointerByDateAndIdComparer> _job_pointer_set;//存储Job指针，按职位发布日期和id排序
std::set<Job*, JobPointerByVersionComparer> _job_pointer_set_by_version;//存储Job指针，按版本(职位创建时间)排序
std::set<int> _job_id_set; //存储职位id，按数字大小排序
std::unordered_set<Job*> _job_pointer_set_of_not_full;//信息不完整职位（未访问过详情页）的集合
```



为了支持能够通过id获得对应的Job对象，要有个以id作为key的job_map，虽然使用单纯的map也可以，但map的内部实现使用的是红黑树，比起哈希表的直接索引速度还是慢了点，因此这里使用了unordered_map。

而由于unordered_map是无序的，如果需要做基于id的有序操作的话，还需要一个有序set，所以多一个job_id_set。

其他的容器也是用来满足各种需求而准备的，比如说``job_pointer_set_of_not_full``，直接存储了所有信息不完整的职位的集合，这样需要批量从职位详情页补全数据时，就不用遍历所有职位数据再剔除掉信息完整的职位数据如此多此一举了。



代码：

```C++
//专为Job类打造的集多种功能为一体的复合容器
class JobContainer : public boost::noncopyable
{
public:
	JobContainer() : _version(0){}
	~JobContainer(){}

public:
	//新增操作
	template<typename... Args>
	Job& emplace(int id,Args&&... args)
	{
		Job* p_job = &_job_map.emplace(
			std::piecewise_construct, std::forward_as_tuple(id), std::forward_as_tuple(id,std::forward<Args>(args)...)).first->second;
		_job_id_set.emplace(id);
		_job_pointer_set.emplace(p_job);
		_job_pointer_set_by_version.emplace(p_job);	
		if (!p_job->m_is_full)
		{
			_job_pointer_set_of_not_full.emplace(p_job);				
		}
		else
		{
			if (_version < p_job->get_version())_version = p_job->get_version();
		}
		uint64_t category_code = p_job->category_code();
		_job_pointer_set_group_by_category_code[p_job->category_code()].emplace(p_job);
		return *p_job;
	}

	//将某个职位标记为“信息已补完”
	void notify_job_full(Job& job)
	{
		job.m_is_full = true;
		_job_pointer_set_of_not_full.erase(&job);

		//写者锁
		_rwlock_job_set_by_version.lock_write();

		_job_pointer_set_by_version.emplace(&job);
		if (_version < job.get_version())_version = job.get_version();

		_rwlock_job_set_by_version.unlock_write();
	}

	//根据id获取职位指针
	Job* get_pointer(int id)
	{
		auto it = _job_map.find(id);
		if (it != _job_map.end())
		{
			return &it->second;
		}
		else
		{
			return nullptr;
		}
	}

	//获取当前职位库的版本（最新创建的职位的创建时间）
	uint64_t get_version()
	{
		return _version;
	}

	bool contains(int id)
	{
		return _job_map.find(id) != _job_map.end();
	}

	//删除，该方法已弃用
	bool erase(int id)
	{
		Job *p_job = get_pointer(id);
		if (p_job != nullptr)
		{
			_rwlock_job_set_by_version.lock_write();

			_job_pointer_set_group_by_category_code[p_job->category_code()].erase(p_job);
			if (!p_job->m_is_full)_job_pointer_set_of_not_full.erase(p_job);
			_job_pointer_set.erase(p_job);
			_job_pointer_set_by_version.erase(p_job);
			_job_map.erase(id);
			_job_id_set.erase(id);

			_rwlock_job_set_by_version.unlock_write();
			return true;
		}
		return false;
	}

	//求[当前的职位清单(_job_pointer_set)]和[目标职位清单(job_pointer_set)]的差集
	void get_difference(const std::set<int>& job_id_set, std::list<Job*>& list)
	{
		//因为std::list的迭代器之间不能做'-'号运算，无法获得差集后的集合大小
		//所以参考std::set_difference的源码重新写了一份，以便得到差集运算后list的大小
		auto it1 = _job_id_set.begin(), last1 = _job_id_set.end();
		auto it2 = job_id_set.begin(), last2 = job_id_set.end();
		while (it1 != last1 && it2 != last2)
		{
			if (*it1<*it2)
			{
				list.emplace_back(get_pointer(*it1++));
			}
			else if (*it2>*it1)
				it2++;
			else
			{
				it1++;
				it2++;
			}
		}
	}



	uint64_t foreach_job_by_version(const std::function<void(const Job&)>& func,uint64_t version_after) const
	{
		//因为会对Job类进行写操作的只有Clawer爬虫，而Clawer爬虫是单线程循环模式
		//而涉及到Job容器的读取的其实只有Query操作，所以用到的读写锁其实就这一个
		//加读锁
		
		_rwlock_job_set_by_version.lock_read();
		uint64_t version = _version;
		auto& clone_set = clone_set_job_by_version();
		_rwlock_job_set_by_version.unlock_read();

		auto begin_it = clone_set.begin();


		if (version_after > 0)
		{
			for (auto it = clone_set.rbegin(); it != clone_set.rend(); it++)
			{
				uint64_t ver = (*it)->get_version();
				if ((*it)->get_version() <= version_after)
				{
					begin_it = it.base();
					break;
				}
			}
		}

		for (auto it = begin_it; it != clone_set.end(); it++)
		{
			func(*(*it));
		}
		return version;
	}

	//遍历job
	void foreach_job(const std::function<void(Job&)>& func, bool include_invalid_job)
	{
		//防止操作期间数据源发生变化引发的问题，直接对克隆容器进行操作
		auto clone_set = _job_pointer_set;
		if (include_invalid_job)
		{
			for (Job* p_job : clone_set)
			{
				func(*p_job);
			}
		}
		else
		{
			Base::Date valid_date = Common::DateHelper::Today() - Common::Days(Conf.ValidJobDays);
			for (Job* p_job : clone_set)
			{
				if (p_job->get_date() >= valid_date)func(*p_job);
			}
		}
	}

	//遍历所有"信息不完整"的职位
	void foreach_job_of_not_full(const std::function<void(Job&)>& func, bool include_invalid_job)
	{
		//防止操作期间数据源发生变化引发的问题，直接对克隆容器进行操作
		std::unordered_set<Job*> clone_set = _job_pointer_set_of_not_full;
		if (include_invalid_job)
		{
			for (Job* p_job : clone_set)
			{
				func(*p_job);
			}
		}
		else
		{
			Base::Date valid_date = Common::DateHelper::Today() - Common::Days(Conf.ValidJobDays);
			for (Job* p_job : clone_set)
			{
				if (p_job->get_date() >= valid_date)func(*p_job);
			}
		}
	}		

private:
	const std::set<Job*, JobPointerByVersionComparer>& clone_set_job_by_version() const
	{
		static std::set<Job*, JobPointerByVersionComparer> clone_set;
		static uint64_t clone_set_version = 0;
		
		if (_version != clone_set_version)
		{
			clone_set = _job_pointer_set_by_version;
			clone_set_version = _version;
		}

		return clone_set;
	}
	
	static JobPointerByDateAndIdComparer& _job_pointer_comparer()
	{
		static JobPointerByDateAndIdComparer job_pointer_comparer;
		return job_pointer_comparer;
	}
	//JobPointerByVersionComparer
private:
	uint64_t _version;


	std::unordered_set<Job*> _job_pointer_set_of_not_full;//不完整职位的集合
	std::unordered_map<int, Job> _job_map;//该map保存职位信息，key为职位的id，职位的实体对象存储在该map中
	std::unordered_map<int64_t, std::unordered_set<Job*>> _job_pointer_set_group_by_category_code;//存储Job指针，按职位分类码将职位数据进行分类
	std::set<Job*, JobPointerByDateAndIdComparer> _job_pointer_set;//存储Job指针，按职位发布日期和id排序
	std::set<Job*, JobPointerByVersionComparer> _job_pointer_set_by_version;//存储Job指针，按版本(职位创建时间)排序
	std::set<int> _job_id_set; //存储职位id，按数字大小排序
	std::unordered_set<Job*> _job_pointer_set_of_not_full;//信息不完整职位（未访问过详情页）的集合
	
	mutable Base::RWLock<Base::SPIN> _rwlock_job_set_by_version;//读写锁，由于读取写入占用时间都不多，所以采用自旋锁
};
```

以上为职位容器类的代码，逻辑其实没什么好说的，就是执行新增等操作时，对多个内部容器执行相应操作，然后注意一些线程安全的问题，该上锁的地方要上锁同步，这里就不详细讲了。



**职位类方法代码(节选)：**

有了容器类，就可以正式着手编写职位类的代码了，因为代码比较多，所以只节选几个方法讲一下：

新增方法：

```C++
Job& Job::Add(int id, const std::string &title, const std::string &type, int hiring_number, const std::string &location, const Base::Date &date)
{
	using Common::DBManager;
	Job* p_job = _job_container.get_pointer(id);
	if (p_job!=nullptr)//如果职位已经存在，执行更新操作
	{
		Job& job = *p_job;
		if (job.m_date != date)//一般来说职位信息发生变化的情况只有日期发生改变，只比较日期，其他暂时不考虑
		{
			m_date = date;			
			using namespace Base::Database;
			static const std::string kSql("UPDATE tjh_job_detail SET job_date=? WHERE job_id=?;");
			Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSql, job.m_date, job.m_id);
		}
	}
	else
	{
		p_job = &_job_container.emplace(id, title, GetTypeID(type), hiring_number, GetLocationID(location), date);
		Job& job = *p_job;
		job.m_version = 0;
		using namespace Base::Database;
		static const std::string kSql("INSERT INTO tjh_job_detail(job_id,job_title,job_type,job_location,job_hiring_number,job_date,version,is_full,is_available) VALUES(?,?,?,?,?,?,?,?,?);");
		Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSql, job.m_id,job.m_title,job.m_type,job.m_location,job.m_hiring_number,job.m_date,job.m_version,false,true);	

	}
	return *p_job;
}
```

如代码所示，新增操作在添加职位信息至容器后，还有个写入数据库的操作，注意这里使用的是``Common::DBManager``是我自定义的数据库管理类，这里提交的语句并不是立即执行，而是异步执行。关于``Common:DBManager``的具体实现请看[公共组件-数据库管理类](/logic/server/base/database.md)章节。

另外，因为爬虫模块在腾讯招聘网抓取信息时，有些职位的发布日期会发生改变，因此有可能出现职位已存在的情况，如果是这种情况只更新一下日期。



获取方法：

```C++
Job& Job::Get(int id)
{
	assert(ContainsKey(id));
	return *_job_container.get_pointer(id);
}

Job* Job::GetPointer(int id)
{
	return _job_container.get_pointer(id);
}
```



补全信息方法：

```C++
bool Job::SetDetail(int id, const std::string &duties, const std::string &requirements)
{
	Job* p_job = _job_container.get_pointer(id);
	if (p_job == nullptr) return false;
	return SetDetail(*p_job, duties, requirements);
}

bool Job::SetDetail(Job& job, const std::string &duties, const std::string &requirements)
{
	job.m_duties = duties;
	job.m_requirements = requirements;
	job.m_version = Common::DateHelper::CurrentTimeMillis();
	_job_container.notify_job_full(job);//将状态置为“信息已完整”
	_job_available_callback(job);//回调方法告知Job可用

	using namespace Base::Database;
	static const std::string kSql("UPDATE tjh_job_detail SET job_duties=?,job_requirements=?,version=?,is_full=? WHERE job_id=?;");
	Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, [](const DMLSqlTask& task){
		if (task.execsql_succeeded() && task.get_result() == 0)
		{
			G::LogOfDatabase().errorAndNotifyAdmin(
				fmt("执行修改语句时数据库无变动，数据有可能被人为修改了，语句[%1%]") % task.to_string()
				);
		}
	}, kSql,
		job.m_duties, job.m_requirements,job.m_version, job.m_is_full, job.m_id);
	return true;
}
```



设置职位失效/有效的方法

```C++
void Job::SetIsAvailable(int job_id, bool state)
{
	Job* p_job = _job_container.get_pointer(job_id);
	SetIsAvailable(p_job,state);
}

void Job::SetIsAvailable(Job* p_job, bool state)
{
	using namespace Base::Database;
	if (p_job != nullptr)
	{
		p_job->m_is_available = false;

		static const std::string kSqlJobDetailSetAvailable("UPDATE tjh_job_detail SET is_available = ? WHERE job_id = ?;");
		Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSqlJobDetailSetAvailable , state, p_job->m_id);
	}
}

int Job::SetUnavailableDiffernce(const std::set<int>& job_id_set)
{
	using namespace Base::Database;
	//先求差集
	std::list<Job*> exclude_list;
	_job_container.get_difference(job_id_set, exclude_list);

	static const std::string kSqlJobDetailSetUnavailable("UPDATE tjh_job_detail SET is_available = false WHERE job_id = ?;");
	for (Job* p_job : exclude_list)
	{
		p_job->m_is_available = false;
		Common::DBManager::EnqueueDMLTask(SqlTaskPriority::Normal, kSqlJobDetailSetUnavailable, p_job->m_id);
	}

	return exclude_list.size();
}
```



查询方法：

```C++
std::shared_ptr<JobDetailQueryExpression> Job::Query(const std::string& query_exp_str, std::vector<const Model::Job*>& result)
{
	auto exp = JobDetailQueryExpressionHelper::Parse(query_exp_str);
	ForeachJobReadonly([&exp, &result](const Model::Job& job){
		if (job.get_is_available() && exp->is_match(job))result.emplace_back(&job);
	}, 0);
	return exp;
}

uint64_t Job::Query(const std::shared_ptr<JobDetailQueryExpression>& query_exp,
	std::vector<const Model::Job*>& result, uint64_t version_after)
{
	return ForeachJobReadonly([&query_exp, &result](const Model::Job& job){
		if (job.get_is_available() && query_exp->is_match(job))result.emplace_back(&job);
	}, version_after);
}

```

表达式对象自带is_match匹配方法可以判断job是否满足表达式的要求，关于表达式编译器的实现请看[查询表达式编译器](/logic/server/base/queryexp.md)章节



初始化方法（从数据库加载数据到容器）：

```C++
void Job::AsyncLoadFromDataBase()
{
	using Common::DateHelper;
	using namespace Base::Database;

	//读取职位类别数据（id-名称对）
	static const std::string kSqlQueryJobType("SELECT type_id,type_name FROM tjh_job_type;");
	Common::DBManager::EnqueueDQLTask(SqlTaskPriority::Highest, [](const DQLSqlTask& task){
		foreach_line_in_resultset_init(task, [](sql::ResultSet* res){
			auto it = _type_map_r.emplace(res->getString("type_name"), res->getInt("type_id")).first;
			_type_map.emplace(it->second, it->first);
			_type_count++;
		});
	}, kSqlQueryJobType);

	//读取职位地点数据（id-名称对）
	static const std::string kSqlQueryJobLocation("SELECT location_id,location_name FROM tjh_job_location;");
	Common::DBManager::EnqueueDQLTask(SqlTaskPriority::Highest, [](const DQLSqlTask& task){
		foreach_line_in_resultset_init(task, [](sql::ResultSet* res){
			auto it = _location_map_r.emplace(res->getString("location_name"), res->getInt("location_id")).first;
			_location_map.emplace(it->second, it->first);
			_location_count++;
		});
	}, kSqlQueryJobLocation);

	//读取职位数据
	static const std::string kSqlQueryJobDetail("SELECT * FROM tjh_job_detail;");
	Common::DBManager::EnqueueDQLTask(SqlTaskPriority::Highest, [](const DQLSqlTask& task){
		foreach_line_in_resultset_init(task, [](sql::ResultSet* res){
			uint64_t version = res->getUInt64("version");
			_job_container.emplace(
				res->getInt("job_id"), res->getString("job_title").c_str(), res->getInt("job_type"), res->getInt("job_hiring_number"),
				res->getInt("job_location"), DateHelper::ToDate(res->getString("job_date").c_str()),
				res->getString("job_duties").c_str(), res->getString("job_requirements").c_str(),
				version, res->getBoolean("is_full"),res->getBoolean("is_available"));
		});
	}, kSqlQueryJobDetail);

	//加载职位已经抓取完整的日期(爬虫模块进行抓取作业时将跳过这些日期)
	static const std::string kSqlQueryJobDateOfFull("SELECT job_date FROM tjh_job_date_of_full;");
	Common::DBManager::EnqueueDQLTask(SqlTaskPriority::Highest, [](const DQLSqlTask& task){
		foreach_line_in_resultset_init(task, [](sql::ResultSet* res){
			_date_set_of_job_info_full.emplace(DateHelper::ToInt(DateHelper::ToDate(res->getString("job_date").c_str())));
		});

		//填充用于传输职位地点、类型等信息的protobuf数据
		for (auto it = _type_map.begin(); it != _type_map.end(); it++) {
			_job_related_info.add_type_id(it->first);
			_job_related_info.add_type_name(it->second);
		}
		for (auto it = _location_map.begin(); it != _location_map.end(); it++) {
			_job_related_info.add_location_id(it->first);
			_job_related_info.add_location_name(it->second);
		}

		_is_ready = true;
		_cond_ready.notify_one();//通知主线程整个查询任务已经结束
		G::LogOfProgram().info("Job库已完成初始化");
	}, kSqlQueryJobDateOfFull);

}
```

