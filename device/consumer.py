#!/usr/bin/env python
import pika
import json
import hashlib

connection = pika.BlockingConnection(
    pika.ConnectionParameters(host='localhost', port=5672))
channel = connection.channel()

channel.exchange_declare(exchange='logs', exchange_type='fanout')

# 185426 is secury code
str2hash = "123456"
result = hashlib.md5(str2hash.encode())
result = channel.queue_declare(
    queue=result.hexdigest(), exclusive=True)
queue_name = result.method.queue

channel.queue_bind(exchange='logs', queue=queue_name)

print(' [*] Waiting for logs. To exit press CTRL+C')


def callback(ch, method, properties, body):
    # bytes to string
    body = body.decode("utf-8")
    y = json.loads(body)
    print(y["name"])


channel.basic_consume(
    queue=queue_name, on_message_callback=callback, auto_ack=True)

channel.start_consuming()
