var amqp = require('amqplib/callback_api');
const Sensor = require('../models/Sensor');
const Device = require('../models/Device');
const Tracking = require('../models/Tracking');

module.exports = function(cb) {
  amqp.connect('amqp://guest:guest@rabbitmq:5672', function(err, conn) {
    if (err) {
      throw new Error(err);
    }

    // cb(conn);
    conn.createChannel(function(err, ch) {
      if (err) {
        throw new Error(err);
      }
      var ex = 'logs';

      ch.assertExchange(ex, 'fanout', { durable: false });
      ch.assertQueue(
        'control',
        { exclusive: true },
        function(err, q) {
          console.log(' [*] Waiting for messages in %s. To exit press CTRL+C', q.queue);

          if (err) {
            throw new Error(err);
          }
          ch.bindQueue(q.queue, ex, '');
          ch.consume(q.que, function(msg) {
            console.log(' [x] %s', msg.content.toString());
            addSensor(msg.content.toString());
          });
        },
        { noAck: true }
      );
    });
  });
};

const addSensor = async req => {
  req = JSON.parse(req);
  try {
    let device = await Device.findBySecurityCode(req.security_code);
    if (!!device) {
      req.data.forEach(async sensor => {
        // find sensor in device
        let obj = device.sensors.find(o => o.name === sensor.name);
        if (!!obj) {
          // check it over the bucket = 1hour

          let sensorData = await Sensor.findById({ _id: obj._id });
          let dataSet = sensorData.dataSets.slice(-1)[0];

          // because of JSON.stringify make 2020-06-12T22:35:21+07:00 -> "2020-06-12T22:35:21+07:00" so dataSet.bucket must start 1 to 13
          if (JSON.stringify(dataSet.bucket).substr(1, 13) === req.created_at.substr(0, 13)) {
            let trackingData = await Tracking.findById({ _id: dataSet._id });

            // update bucket
            dataSet.data =
              (dataSet.data * trackingData.data.length + sensor.data) /
              (trackingData.data.length + 1);

            await sensorData.save();

            // update data to traking schema
            trackingData.data.push(sensor.data);
            // update created at to traking schema
            trackingData.created_at.push(req.created_at);
            // save tracking data
            trackingData.save();
          } else {
            insertNewData(sensorData._id, sensor.data, req.created_at);
          }
        } else {
          // =================================
          // Init sensor =====================
          // =================================
          let initSensor = {
            name: sensor.name,
            deviceId: device._id
          };
          let newSensor = new Sensor(initSensor);
          newSensor = await newSensor.save();

          await Device.updateOne(
            { _id: device._id },
            {
              $push: { sensors: [{ _id: newSensor._id, name: newSensor.name }] }
            }
          );

          // new dataset
          insertNewData(newSensor._id, sensor.data, req.created_at);
        }
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const insertNewData = async (sensorId, data, created_at) => {
  const sensorData = {
    sensorId,
    data,
    created_at: [created_at]
  };
  let trackingData = new Tracking(sensorData);
  trackingData = await trackingData.save();

  await Sensor.updateOne(
    { _id: sensorId },
    {
      $push: { dataSets: [{ _id: trackingData._id, bucket: created_at, data: data }] }
    }
  );
};

// form data
// {
//   security_code: '1234',
//     data : [
//     {
//       name : "humidity",
//       data : 35
//     },
//     {
//       name: 'temperature'
//       data : 15
//     }],
//     created_at : '15-16'
// }

// new Date().toISOString()
