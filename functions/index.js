const functions = require("firebase-functions");
const admin = require("firebase-admin");
const serviceAccount = require("./cheap-internal-sms.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cheap-internal-sms-app-default-rtdb.firebaseio.com",
});

// send data message to a device
exports.sendMessage = functions.https.onRequest((req, res) => {
  const registrationToken = req.query.registrationToken;
  const phone = req.query.phone;
  const message = req.query.message;
  const payload = {
    data: {
      phone: phone,
      message: message,
    },
  };
  admin
      .messaging()
      .sendToDevice(registrationToken, payload)
      .then((response) => {
        console.log("Successfully sent message:", response);
        res.send(response);
      })
      .catch((error) => {
        console.log("Error sending message:", error);
        res.send(error);
      });
});
