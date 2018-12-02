## 续做功能

要让程序拥有健壮性的话，必须得实现中断续做功能，这样就算程序在人为非人为因素影响下如果退出了，下次运行能继续上次进行到一半的作业.

这个功能我是这样实现的，首先将爬虫程序划分为**工作状态**和**非工作状态**两种状态。在爬虫程序开始运作前，将工作状态的flag置为true并存入数据层。

然后抓取途中，及时将当前抓取到的页码等现场信息也保存到数据层。

抓取结束后，将flag置为false并更新数据层。

这样一来，程序就算被中断，重启的时候会读取数据库，如果发现到程序处于工作状态，则会在根据存储的必要信息恢复现场，继续上次的作业。 

恢复现场需要3个数据：
1. 目前抓取到的页码索引
2. 以及正在进行的作业的种类（是通常抓取作业，还是特殊抓取作业）。
3. 目前正在抓取职位的发布日期。

特殊抓取作业的现场还原比较容易，因为特殊抓取作业的抓取范围是固定的，列表页顺序从头访问至尾，所以由当前页码索引继续访问，直到发现某一页出现目标日期发布的职位即可。

而通常抓取作业的话，需要3个数据：当前页码、当前子任务抓取范围的起始日期、以及结束日期。而当前页码已经有了，起始日期可以直接设定为当前正在抓取的职位的日期不影响，而结束日期可以通过动态计算得到。

代码：

```C++
if (_c.m_is_working)//上次是否抓取到一半异常退出
{
	//如果is_working==true，则表示上次的抓取任务进行到一半的时候意外退出了
	//尝试从上次抓取的地方开始抓取			
	start_page_index = _c.m_current_clawing_index / 10;//一个页列表页有10个职位信息
}
else
{
	//...
}
//......

//抓取子任务的起始日期
Date sub_start_date = _c.m_claw_current_date;

//......

if (_c.m_is_working)
{//发现上次有未完成作业
	if (_c.m_is_special)
	{//进行的是特殊抓取作业
		sub_end_date = _c.m_claw_target_date;
	}
	else
	{//通常抓取作业
		set_sub_end_date();//动态计算得到子任务的结束日期
	}					
	log.info(fmt("发现上次作业进行到一半时被中断，从上次抓取到的地方(第%1%页)继续，起始日期[%2%]，目标日期[%3%]")
		% (page_index + 1) % DateHelper::ToString(sub_start_date) % DateHelper::ToString(sub_end_date));
	_claw(page_index, sub_start_date, sub_end_date);
	
	if (_c.m_is_special)
	{
		do_special();//进行特殊抓取任务的额外操作（删除已失效职位）
	}
	else
	{
		sub_start_date = sub_end_date - Days(1);
		loop_claw_sub();
	}
	Model::JobClawResult::SaveCurrentResult();//保存抓取结果
}
//...
```