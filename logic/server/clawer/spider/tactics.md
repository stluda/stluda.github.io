## 抓取策略

抓取策略分为**通常抓取策略**和**特殊抓取策略**，接下来会按顺序讲解。

### 通常抓取策略

先解释一下，现在的腾讯招聘网的发布日期不知道什么原因全部变成了当天日期，但我在当时设计程序的时候，职位的发布日期是有区别的，当天发布就是当天发布，以前发布的就是以前发布，不会像现在这样全部都是当天日期。

因此当时我基于这个特点制定了一套策略，虽然现在这个策略已经没有意义了，但还是讲一下吧：

* 缩减抓取范围<br>
  首先，考虑到职位的时效性，太早发布的职位或许不合需求，因此程序的配置是允许设定有效日期范围的，超出范围的职位不进行抓取。

* 然后，就是如何提高效率跳过已经抓取过的职位信息？<br><br>
  首先职位信息是一个可翻页的列表，经我观察发现，当时它的职位是按日期倒序排序的，也就是说第一页职位的发布日期一般是今天或昨天，然后到前天，一直到最早的日期。然后逻辑上已有的职位发布日期就算发生改变，也只会变得更新（信息有所更新），不可能变得更旧。也就是说，如果确定本地数据库里发布日期为某一天的职位的数据齐全了，那么抓取时该日期页面的数据都可以跳过。<br><br>
  举个例子，如果今天是5月15日，需要抓取5月15日到5月5日的数据，然后数据库的状态现在是这样的：

| 发布日期 | 本地数据库有完整数据 |
| :------: | :------: |
| 5月15日 |  |
| 5月14日 |  |
| 5月13日 |  |
| 5月12日 | 有 |
| 5月11日 | 有 |
| 5月10日 |  |
| 5月9日 | 有 |
| 5月8日 | 有 |
| 5月7日 |  |
| 5月6日 |  |
| 5月5日 | |


那么，程序在进行抓取作业时，其实没必要将5月15日~5月5日的数据全部抓取，5月12日~5月11日，5月9日~5月8日这两个区间的数据是可以跳过的。也就是说整个抓取任务可以分成3个子任务，分别抓取5月15日~5月13日，5月10日，以及5月7日~5月5日。

那么程序上如何实现？

1. 编写确定子任务起始日期，以及结束日期的方法：

   起始日期：在抓取日期范围内，找到第一个数据库中职位数据不完整的日期（也就是说不能确定发布日期为那一天的职位信息是不是已经抓取全了）

   结束日期：在抓取日期范围内，从起始日期开始，找到第一个数据库中职位数据完整的日期后（确定发布日期为那一天的数据是完整的，可以跳过），得到的日期+1天即为我们要的日期。

2. 定位日期对应页码的方法。比如说子任务的起始日期为5月7日，定位后发现第一次出现这个该日期职位的页码为第33页（算法晚点介绍）

3. 编写子任务的页面抓取方法，传入参数为起始页码，起始日期，结束日期。

4. 做一个循环，不断执行子任务直到起始日期<目标日期。

注意因为招聘网的职位信息是按日期倒序排列的，所以结束日期和目标日期会比起始日期的值要小。

代码：

```C++
//抓取子任务的起始日期
Date sub_start_date = _c.m_claw_current_date;
//抓取子任务的结束日期
Date sub_end_date = sub_start_date;				

//该方法用来计算抓取子任务的起始日期
auto set_sub_start_date = [this,&sub_start_date](){
	while (Job::IsJobInfoComplete(sub_start_date) && sub_start_date >= _c.m_claw_target_date) sub_start_date -= Days(1); 
};

//该方法用来计算抓取子任务的结束日期
auto set_sub_end_date = [this,&sub_start_date,&sub_end_date](){
	sub_end_date = sub_start_date;
	while (!Job::IsJobInfoComplete(sub_end_date - Days(1)) && sub_end_date > _c.m_claw_target_date) sub_end_date -= Days(1); 
};
int page_index = start_page_index;

auto loop_claw_sub = [this, &sub_start_date, &sub_end_date, 
	&set_sub_start_date, &set_sub_end_date, &page_index](){
	//循环执行，直到起始日期<目标日期
	while (sub_start_date >= _c.m_claw_target_date)
	{
		//寻找起始日期对应的页面编号
		page_index = _findStart(page_index, sub_start_date);
		//计算抓取子任务的目标日期
		set_sub_end_date();
		log.info(fmt("开始子任务，从第%1%页开始抓取，起始日期[%2%]，目标日期[%3%]")
			% (page_index + 1) % DateHelper::ToString(sub_start_date) % DateHelper::ToString(sub_end_date));
		//抓取日期范围为[sub_start_date,sub_end_date]的职位
		_claw(page_index, sub_start_date, sub_end_date);

		//开始新一轮子任务，计算新子任务的起始日期
		sub_start_date = sub_end_date - Days(1);
		set_sub_start_date();
	}
};
```



```C++
log.info("开始通常抓取作业");
if (Model::JobClawResult::IfJobInfoUpdated())
{
	log.info("招聘网第1页信息发生了改变，重头开始抓取");
	log.debug(fmt("上次职位列表页第一页hash：%1%，当前职位列表页第一页hash：%2%")
		% _last_result.m_first_list_page_hash % _current_result.m_first_list_page_hash);
	set_sub_start_date();
	loop_claw_sub();
	Model::JobClawResult::SaveCurrentResult();//保存抓取结果
}
```

开始抓取前调用一下``set_sub_start_date()``，确定抓取任务的起始日期后，再调用``loop_claw_sub()``就能循环执行抓取子任务了。



这里讲一下`` _findStart``方法，这是用来确定子抓取任务应该从哪一页开始的方法。

讲一下实现思路：

1. 首先，经我观察，招聘网在更新职位信息时，当天的职位数据一般是最多的，这是因为当天不仅会发布新职位信息，一些旧的职位如果信息有更改，其发布日期也会更新。因此就会有一个规律：离当前日期越近的日期，职位信息会越多。因此经过数天观察后可以建个模型，预测某一天发布的职位有多少个。

   规律如下：

   当天平均数据为32页，因此预测第一次出现昨天发布的职位是在第32页。

   昨天平均数据为16页，因此预测第一次出现前天发布的职位是在第48页。

   2天前~5天前每天平均数据为8页，因此第一次出现预测3天前、4天前、5天前、6天前的职位分别是第56、64、72、80页....

   以此类推，日期距离当前日期越远，该天剩余的仍处于发布状态的职位越少。

2. 预测毕竟仅仅是预测，不能直接拿来使用。我们记预测得到的页码为x，实际抓取一下那一页的数据，看看那一页的职位都是什么日期发布的。

3. 如果比所需日期早，那么向后翻n页，抓取第(x+n)页的数据，看看这一页的职位都是什么日期发布的。重复这个步骤，直到出现日期刚好为目标日期，或比目标日期晚为止。（n的值是计算得出的，会根据当前页码动态变化）

4. 反之，如果比所需日期晚，那么向前翻n页，抓取第(x-n)页的数据，看看这一页的职位都是什么日期发布的。重复这个步骤，直到出现日期刚好为目标日期，或比目标日期早为止。（n的值是计算得出的，会根据当前页码动态变化）

5. 经过3步骤或4步骤后，我们现在可以得到一个区间了，我们需要找的页码就在这个区间里。接下来就是用折半查找法，具体定位到我们所需要找的日期所对应页码。



代码：
```c++
//指定一个职位发布日期，找到第一次出现该日期的页面
int TencentJobInfoClawer::_findStart(int start, const Base::Date& date)
{
	using Base::Date;
	using Common::Days;

	if (date >= _c.m_first_list_page_first_date)return 0;
	
	//如果库中有以前的记录，且没有过期(第一页hash值未发生改变)，则直接引用
	if (Model::JobClawResult::GetLastResultOfItemIndexOfDate(date, start))
		return start / 10;//（注意这是职位的索引而不是页码的索引，所以要除以10）	
	
	//观察历史数据，发现一般第一天的数据最多(大概30页上下)，第二天其次，之后慢慢减少
	//按照这个规律建立一个简单的模型，以预测一个日期第一次出现的大概位置
	std::function<int(int)> predictIndex = [&predictIndex](int day_length)
	{
		switch (day_length)
		{
		case 0:
			return 0;
		case 1:
			return 32;
		case 2:
			return 48;
		default:
			if (day_length<0)return 0;
			else if (day_length<=5) return predictIndex(2) + 8 * (day_length - 2);
			else if (day_length<=11) return predictIndex(5) + 4 * (day_length - 5);
			else if (day_length<=23) return predictIndex(11) + 2 * (day_length - 11);
			else if (day_length<=30) return predictIndex(23) + day_length - 23;
			else return predictIndex(30);
		}
	};
	std::function<int(int)> getIncOfIndex = [](int page_index)
	{
		if (page_index <= 2)return 1;
		else if (page_index <= 4)return 2;
		else if (page_index <= 8)return 4;
		else if (page_index <= 16)return 8;
		else if (page_index <= 32)return 16;
		else if (page_index <= 72)return 8;
		else if (page_index <= 96)return 4;
		else return 2;
	};

	Date first_date, last_date;
	int overflowed_index = (1 << 15) - 1;

	//获得下一步应该前进的方向，1表示前进，-1表示回退，0表示已经找到
	std::function<int(int)> getNextDirection = 
		[this, &first_date, &last_date, &date, &overflowed_index](int page_index)
	{

		//返回false说明列表页的数据为空已越界，需回退
		if (!_getJobDateOfPage(page_index, first_date, last_date))
		{
			if (page_index<overflowed_index)overflowed_index = page_index;
			return -1;
		}				

		if (last_date > date)
		{
			//情况A：应前进
			return 1;
		}
		else if (date > first_date)
		{
			//情况B：应回退
			return -1;
		}
		else
		{
			//只可能是，first_date>=date>=last_date的情况，last_date不用管它
			if (first_date > date)
			{
				//情况C1：找到了，就是这一页
				return 0;
			}
			else
			{
				//情况C2：first_date==date 
				if (page_index == 0)
				{
					//如果是第一页，因为已经没有上一页了，所以已经确定是第一页
					return 0;
				}						
				else
				{
					//因为不确定这个first_date是否为第一次出现Date的页码，故应暂时回退
					//虽然返回-1但不代表一定不是这一页
					return -1;
				}		
			}
		}
	};

	first_date = _c.m_first_list_page_first_date;
	last_date = _c.m_first_list_page_last_date;
	int start0 = predictIndex((first_date - date).count());
	log.debug(fmt("predictIndex：%1%") % start0);
	int index = start0 > start ? start0 : start, next_index = index;
	int inc;
	int dir2 = getNextDirection(index);
	if (dir2 == 0)return index;
	
	//一直朝同个方向寻找，直到确定targetIndex在index和next_index之间
	for (int dir1 = dir2; dir1 == dir2; )
	{
		index = next_index;		
		dir1 = dir2;
		inc = getIncOfIndex(index);
		next_index = index + inc*dir1;
		dir2 = getNextDirection(next_index);
		if (dir2 == 0)return next_index;
	}


	if (next_index < index)std::swap(next_index, index);
	//折半查找
	std::function <int(int, int)> binarySearch =
		[&binarySearch, &getNextDirection, &overflowed_index](int start_page_index, int end_page_index)
	{
		if (end_page_index - start_page_index <= 1)
		{
			//如果程序正常运作，是不会出现index相等的情况的
			//如果两个index相差1，说明是情况C2，之前不确定但现在能确定了就是这一页
			//然后还有一种情况就是end_page_index超界了
			return end_page_index>=overflowed_index ? start_page_index : end_page_index;
		}
		else
		{
			int mid_page_index = (start_page_index + end_page_index) / 2;
			switch (getNextDirection(mid_page_index))
			{
			case -1:
				return binarySearch(start_page_index, mid_page_index);
			case 1:
				return binarySearch(mid_page_index, end_page_index);
			case 0:
			default:
				return mid_page_index;
			}
		}
	};

	return binarySearch(index, next_index);
}
```

### 特殊抓取策略

上面讲解的是通常的抓取策略，会选择性跳过数据库中已有的职位信息，提高效率。

但仅仅这样是不够的，因为腾讯招聘网不仅会新增职位，也会删除失效职位。因为腾讯招聘网的数据库不对外公开，对程序来说是个黑盒子，所以能采取的方法无非是以下两种：
1. 访问所有职位的详情页，如果发现页面返回404，说明职位已失效，需要清除。
2. 访问所有的列表页面，整理招聘网目前所有的职位，再和本地数据库的所有职位进行比对，剔除掉本地数据库存在而招聘网不存在的职位。

很显然，第2种方法效率更高。而且清理掉失效数据的同时，也能补全通常抓取策略偶尔会遗漏的数据。

然而，特殊抓取策略是比较占用时间和资源的，对招聘网的web服务器也是一种负担，因此这种特殊抓取不需要很频繁的执行，只要一段时间执行一次，保证相对不错的更新频率，就足够了。

这样，通常抓取策略和特殊抓取策略两种策略并存，既保证了相对快速的数据同步速度，也一定程度上的保证了数据有效性。

特殊抓取策略说白了就是全盘抓取，无脑地从第一页抓取到最后一页。就是多了个清除过时数据的步骤，代码和逻辑比较简单，这里就不献丑了。


### 疑难问题处理

爬虫子程序在进行抓取作业时，不能保证一定不会出现一种情况，就是遇到了解析异常，或访问异常的页面。如果遇到这种情况，程序在经过数次重试无果后，会暂时先记录下职位的ID，并写入服务器日志，作为疑难案例。

爬虫程序在每轮任务中，都会记录访问失败次数，解析失败次数。在一轮抓取结束后，会进行判断，看看这些异常究竟是个例还是普遍情况。如果是普遍情况，说明可能网站在维护，或者一些其他未知情况，这时爬虫子程序会进行较长时间休眠后再重试，并通知邮件管理员。

如果发现只是个例，则会把之前访问失败或解析失败的职位id拿出来，再次尝试访问它的详情页。

这样一来，程序也有一定程度的容错性。关键是遇到特殊情况可以邮件通知管理员，让管理员第一时间知道程序发生了异常。

代码如下：
```C++
using Common::ThreadHelper;
using Common::MailHelper;
//处理疑难队列
if ((double)_c.m_total_detail_parse_errors / (double)(_c.m_total_detail_parse_count + 1) > 0.5)
{
	//这表示有5成以上的页面都解析失败了，有可能遇到了网站维护或是其他预料外的错误
	//邮件通知管理员
	MailHelper::SendMailAdmin("大量详情页解析失败", "解析抓取页面时超过5成以上的页面解析失败，有可能遇到了网站维护或是其他预料外的错误，详情请看系统日志");
	ThreadHelper::Sleep(Conf.ClawerWorkIntervalDiiffcult);//出现疑难问题，爬虫程序进入长时间的休眠
}

//开始处理疑难任务
Model::Job::ForeachJobOfNotFull([this](Model::Job& job){
	//访问疑难职位的详情页
	_clawDetail(job);
},false);

log.info(fmt("该轮抓取结束，等待%1%秒左右开始下一轮抓取") % Conf.ClawerWorkInterval);

ThreadHelper::SleepRnd(Conf.ClawerWorkInterval);
```