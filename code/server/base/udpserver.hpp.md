```c++
#pragma once
#include <boost/asio.hpp>
#include <boost/noncopyable.hpp>
#include <memory>
#include <array>
#include <queue>
#include "base/AesCipherBuffer.hpp"
#include "base/SpinLock.hpp"
#include "base/asio_server/ResponseSender.h"
#include "common/DateHelper.hpp"

//参考改造自boost::asio例子代码
namespace Base {
	namespace AsioServer {
		class UdpServer : boost::noncopyable
		{
		public:
			UdpServer(short port, const std::function<void(const Base::AesCipherBuffer&, const boost::system::error_code&, const boost::asio::ip::udp::endpoint&)>& recv_callback)
				:m_buff(1024), m_port(port), m_recv_callback(recv_callback) 
			{
				m_io_service.reset(new boost::asio::io_service());
				m_socket.reset(new boost::asio::ip::udp::socket(*m_io_service, boost::asio::ip::udp::endpoint(boost::asio::ip::udp::v4(), m_port)));
			}

			std::shared_ptr<boost::asio::ip::udp::socket> get_socket()
			{
				return m_socket;
			}

			void run()
			{
				do_receive();
				m_io_service->run();
			}

			void send(Base::AsioServer::ResponseSender* p_sender)
			{
				m_socket_lock.lock();
				recursion_send(p_sender, 0, p_sender->pack_size());
				m_socket_lock.unlock();
			}

		private:

			void recursion_send(ResponseSender* p_sender, int pack_index, int pack_size)
			{
				AesCipherBuffer* p_buff = p_sender->buff_pointer(pack_index);
				m_socket->async_send_to(boost::asio::buffer(p_buff->pointer(), p_buff->size()),
					p_sender->m_remote_endpoint,
					[this, p_sender, pack_index, pack_size](boost::system::error_code, std::size_t the_size){

					if (pack_index >= pack_size - 1)
					{
						p_sender->m_response_sent_time = Common::DateHelper::Now();
						p_sender->m_response_status = ResponseStatus::Sent;//状态置为已发送
					}
					else
					{
						recursion_send(p_sender, pack_index + 1, pack_size);
					}

				});
			}

			void do_receive()
			{
				m_socket_lock.lock();
				m_socket->async_receive_from(boost::asio::buffer(m_buff.pointer(), 1024), m_remote_endpoint,
					[this](boost::system::error_code ec, std::size_t bytes_recvd)
				{
					m_buff.resize(bytes_recvd);
					m_recv_callback(m_buff, ec, m_remote_endpoint);
					do_receive();
				});
				m_socket_lock.unlock();
			}
			Base::SpinLock m_socket_lock;
			boost::asio::ip::udp::endpoint m_remote_endpoint;
			std::shared_ptr<boost::asio::ip::udp::socket> m_socket;
			std::shared_ptr<boost::asio::io_service> m_io_service;
			short m_port;
			Base::AesCipherBuffer m_buff;
			std::function<void(const Base::AesCipherBuffer&, boost::system::error_code, const boost::asio::ip::udp::endpoint&)> m_recv_callback;
		};
	}
}
```

