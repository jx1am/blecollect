var noble = require('noble');
var mqtt = require('mqtt');

var client = mqtt.connect('mqtt://10.1.0.238:1883');

var devices = [
	{ localName: 'BAT3.3' },
	{ localName: 'BAT3.1' },
	{ localName: 'BAT3.4' },
	{ localName: 'BAT3.0' },
	{ localName: 'BAT3.2' }
]

var state = 'closed'

var dataBuffer = {};
var uniqIds = [];

function appendData(device, str) {
	dataBuffer[device] += str

	var matched = dataBuffer[device].match(/([^\.^;]+);([^\.^;]+)\.(.*)$/);
	//  console.log(matched);
	if (!matched) return null;
	var mac = matched[1];
	var rssi = matched[2];
	var rest = matched[3];

	dataBuffer[device] = rest;

	if (mac.length != 12) {
		console.log('invalid', mac);
		return null;
	}

	if (!uniqIds.includes(mac)) uniqIds.push(mac);

	return { id: mac, RSSI: parseInt(rssi) };
}

function setup() {
	devices.forEach(d => dataBuffer[d.localName] = "");
	uniqIds = [];
}

noble.on('stateChange', function (state) {
	if (state === 'poweredOn') {
		noble.startScanning([],true);
	} else {
		noble.stopScanning();
	}
});

setup();

client.on('connect', () => {

	noble.on('discover', function (peripheral) {

		var localName = peripheral.advertisement.localName;
		//console.log(localName);
		if (localName && localName.startsWith('BA')) {
			console.log("found "+localName);
			peripheral.connect(function (error) {
				console.log('connected to peripheral: ' + peripheral.uuid);

				peripheral.discoverServices(['6e400001b5a3f393e0a9e50e24dcca9e'], function (error, services) {
					console.log('discovered the following services:');

					for (var i in services) {
						console.log('  ' + i + ' uuid: ' + services[i].uuid);
					}
					var locateService = services[0];

					locateService.discoverCharacteristics(['6e400003b5a3f393e0a9e50e24dcca9e'], function (error, characteristics) {

						console.log("char errors: ", error);

						for (var i in characteristics) {
							console.log('  ' + i + ' uuid: ' + characteristics[i]);
						};


						var locateChar = characteristics[0];

						console.log('discovered char' + locateChar);

						// locateChar.read(function (error, data) {
						// 	// data is a buffer
						// 	console.log('manufacture name is: ' + data.toString('utf8'));
						// });

						// to enable notify
						locateChar.subscribe(function (error) {
							console.log('locate values notification on');
						});

						locateChar.on('data', function (data, isNotification) {
							let x = appendData(localName, data.toString());
							console.log('rcv '+localName + ' ', x)
							console.log(uniqIds.length);
							const timestamp = new Date().getTime();
							let msg = [{
								id: localName.replace('\u0000', ''),
								timestamp: timestamp,
								data: [
									x
								]
							}];
							if (x) {
								client.publish('bat/data', JSON.stringify(msg));
								console.log('published '+localName + ' ', x)
							}
							//console.log('value for '+localName+' is now: ', data.toString());
						});


					});

				});

			});
		}


	});

});
