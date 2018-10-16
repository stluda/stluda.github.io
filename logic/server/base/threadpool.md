## 线程池

线程池原理上很简单，无非是管理一个任务队列，建几个线程让其无限阻塞循环等待任务，当有队列里有新任务时通知其中一个线程去取任务执行，但实现起来还是有挺多细节要考虑的。

实现我参考了很多网上的代码，其中最让我印象深刻的是下面两篇。前者第一眼看上去很完美，但看了后者的论述才让我意识到第一篇的实现是有问题的。

>https://www.cnblogs.com/lzpong/p/6397997.html
>https://www.zhihu.com/question/27908489/answer/355105668

这让我对线程池有了更深的认识。

特别是后者提到的第6点bug我想是很容易犯的错误，而且性质比较严重，一旦出现bug很难复查。

以下是前者的代码：

```c++
std::atomic<bool> stopped; //停止标记
std::condition_variable cv_task;// 条件阻塞

//析构函数
inline ~threadpool()
{
    stopped.store(true);
    cv_task.notify_all(); // 唤醒所有线程执行
    ...
}

//阻塞取任务时的代码
this->cv_task.wait(lock,[this] {return this->stopped.load() || !this->tasks.empty();});
```

最致命的地方在于没有对stopped标记上锁，这有可能导致线程池销毁时的工作线程无限等待造成的线程泄露。

为什么，请让我逐步分析：

首先是阻塞取任务时的代码

``this->cv_task.wait(lock,[this] {return this->stopped.load() || !this->tasks.empty();});``

其实等价于

```c++
while(!this->stopped.load()&&this->tasks.empty())//当stopped为假且任务队列为空时才执行循环
{
	cv_task.wait(lock);
}
```

乍一看没什么不对啊，线程池销毁后，stopped置为true，然后cv_task.notify_all()通知线程不再阻塞，直接会跳出循环，怎么会导致无限等待？别急，想象一下下面这种状况

```c++
std::unique_lock<std::mutex> lock{ this->m_lock };
while(!this->stopped.load()&&this->tasks.empty())
{
    //<-首先工作线程的执行到这里，注意此时stopped仍为false，且任务队列为空，下面的wait暂时还没执行
	cv_task.wait(lock);
}
...
//↓此时另一个线程里，析构函数的线程连续执行了下面两条代码
//将stopped置为true，且在上面的cv_task.wait(lock)执行之前，就已经执行了cv_task.notify_all()
stopped.store(true);
cv_task.notify_all(); 
...

cv_task.wait(lock);//再次回到这里，由于notify_all();比wait()更早执行，所以直接会导致wait()无限等待！
```

没错吧，如果是这种情况，虽然发生概率可能不高，但确实有可能导致工作线程无限等待无法得到释放。

而如果给``stopped=true``的语句加锁的话

```c++
std::unique_lock<std::mutex> lock{ this->m_lock };
stopped.store(true);
```

析构函数的代码块和工作线程取任务的循环代码块将不可能穿插执行，就避免了以上那种情形的发生。

同时这里将``stopped``设计为``atomic``也是没有必要的，因为``atomic``的原子特性其实更多是为了保证多个线程同时对一个值进行写操作时不会出现冲突，而这里只有析构函数会``stopped``进行写操作，不会出现冲突情况。

我想设计者的初衷是应该是利用``atomic``的互斥特性，省去加锁的步骤吧。遗憾的是``atomic``只能保证``!this->stopped.load()``与``stopped.store(true);``这两条语句互斥而已，并没有解决可能导致无限等待的问题。