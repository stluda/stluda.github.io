## 工作线程池

前面讲到了接收线程在收到新数据时会将数据插入队列，那么工作线程自然是要取数据了，取数据的代码如下：

```c++
while (true)
{
    std::unique_lock<std::mutex> lock(mutex_request_data_queue);
    if (request_data_queue.empty())
    {
        //如果队列为空，则阻塞等待，直到队列有数据为止
        cv_queue_not_empty.wait(lock);
    }
    do
    {
        //从队列中取出一个请求，并处理
        lock.lock();
        auto t = std::move(request_data_queue.front()); 
        request_data_queue.pop();
        lock.unlock();
		
        //提交到线程池执行
        pool.execute([t = std::move(t), &recv_data_handler](){
            recv_data_handler(t.first, t.second);
        });        
    } while (!request_data_queue.empty());
}
```

这里使用了条件变量，如果队列为空则会先休眠，直到被唤醒。被唤醒后，循环从队列取出数据，交给线程池执行具体业务，直到队列再次为空。

途中有数次上锁解锁的操作，来保证队列的线程安全。

（关于线程池我自己没有造轮子，更多参考了网上的代码。但经过多番对比后我发现有些线程池的实现是有问题的，所以说用别人的东西还是要谨慎。关于我对线程池的考察，有兴趣可以看看：[线程池](/logic/server/base/threadpool.md)）



然后就是对数据的解密，判断出类别，在执行相应的代码。数据包的加密解密使用aes-128-gcm算法，数据使用protobuf包装，详细请看[通讯协议](/logic/proto.md)环节。

```c++
auto recv_data_handler = [this](const Base::AesCipherBuffer& request_data, Base::AsioServer::ResponseSender* response_sender_ptr){

    //秘钥
    const char* key = Conf.AesKey.c_str();

    char request_buff[1024];
    //对收到的数据进行AES解密
    int ret_size = Common::CryptoHelper::AES_128_GCM_Decrypt(request_data.const_pointer() + 2, request_data.size() - 2, key, request_buff);

    //将数据包还原成protobuf对象
    TencentJobHunterMessage::Request request;
    if (request.ParseFromArray(request_buff, ret_size))
    {
        switch (request.type())
        {
        case TencentJobHunterMessage::Type::LOGIN:
            _deal_with_login_request(request, response_sender_ptr);
            break;
        case TencentJobHunterMessage::Type::REGISTER:
            _deal_with_register_request(request, response_sender_ptr);
            break;
        case TencentJobHunterMessage::Type::ADD_JOB_QUERY:
            _deal_with_new_job_query_request(request, response_sender_ptr);
            break;
        //...根据类别执行不同的业务逻辑，数量较多就不铺开了
        }
    }
    else
    {
        log.debug_with_data("解析响应时出错，写入解密前数据信息", request_data.const_pointer(), request_data.size());
        log.debug_with_data("写入解密后数据信息", request_buff, ret_size);
        //解析响应时出错，更新发送器状态
        response_sender_ptr->set_status_parse_error();
    }
};

```



#### 具体业务逻辑

请求对应的具体业务逻辑我只打算选讲，毕竟种类太多（登录、注册、查询、删除查询记录、查看职位详情、添加任务、删除任务等等）全部展开来就太多了，而且内容大同小异没必要全部讲。



接下来讲解一下登录和查询请求的处理：

##### 登录

先上流程图：

{% mermaid %}
graph TD;
  A-->B;
  A-->C;
  B-->D;
  C-->D;
{% endmermaid %}

代码：

```c++
void TencentJobUserServer::_deal_with_login_request(const TencentJobHunterMessage::Request& request, Base::AsioServer::ResponseSender* response_sender_ptr)
{
	//秘钥
	const char* key = Conf.AesKey.c_str();

	//创建响应信息
	TencentJobHunterMessage::Response response;
	response.set_type(TencentJobHunterMessage::Type::LOGIN);
	response.set_request_time(request.request_time());

	//解析客户端请求
	bool success_flag = false;
	Model::User* user;
	Model::Session* session;
	std::string session_id = request.session();

	if (session_id != "")
	{
		if ((session = Model::Session::GetSessionPointer(request.session())) != nullptr){
			//基于session的快速登录
			user = &session->get_user();
			success_flag = true;
		}
		else
		{
			_send_response(response, response_sender_ptr, TencentJobHunterMessage::ErrorCode::SESSION_INVALID_ID);
			return;
		}
	}
	else
	{
		std::string username = request.username();
		std::string password = request.password();

		user = Model::User::GetPointer(username);

		if (user != nullptr)
		{
			std::string salt = user->get_salt();
			std::string m_pass_md5 = user->get_pass();
			std::string pass_md5 = Common::CryptoHelper::MD5(password, salt);

			//密码比对正确，登录成功
			if (pass_md5 == m_pass_md5)
			{
				success_flag = true;

				//创建session并保存
				//如果没有session_id则创建一个全新的
				if (!Model::Session::GetSessionIdByUser(*user, session_id))
				{
					Model::Session& session =
						Model::Session::CreateSession(*user);
					session_id = session.get_id();
					user->set_session(session_id);
				}
			}
		}
	}

	if (success_flag)
	{
		//将session写入response
		response.set_session(session_id);

		//写入职位类型映射消息
		response.mutable_job_related_info()->CopyFrom(Model::Job::GetRelatedInfo());

		//写入查询结果记录（只写入概要信息，不写入详细数据）
		user->set_query_result_info_proto(response.mutable_job_query_result_info());

		//TASK列表的HASH，可以通过HASH值是否改变来判断任务列表以及查询结果是否有变化
		response.set_task_query_result_changed_time(user->get_task_query_result_changed_time());


		response.set_error_code(TencentJobHunterMessage::ErrorCode::SUCCESS);
	}
	else
	{
		//失败返回1001（用户名密码错误）  
		response.set_error_code(TencentJobHunterMessage::ErrorCode::LOGIN_INCORRECT_PASS);
	}

	_send_response(response, response_sender_ptr);

}
```



可以看到，登录分为两种，一种是基于session的快速登录，一种是基于用户名密码的登录。

在第一次登录时会使用用户名密码，一旦成功登录过，客户端下次会使用服务端返回的session来快速登录，直到session失效。

