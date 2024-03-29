const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {getFirestore} = require("firebase-admin/firestore");
const parser = require("libphonenumber-js").parsePhoneNumberFromString;
const {carrier} = require("libphonenumber-geo-carrier");

const serviceAccount = require("./cheap-internal-sms.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cheap-internal-sms-app-default-rtdb.firebaseio.com",
});
const db = getFirestore();

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
exports.createUser = functions.database
    .ref("/users/{token}")
    .onCreate((snapshot, context) => {
    // Grab the current value of what was written to the Realtime Database.
      const original = snapshot.val();
      const token = context.params.token;
      functions.logger.log("logging", original);
      // You must return a Promise when performing asynchronous
      // tasks inside a Functions such as
      // writing to the Firebase Realtime Database.
      // Setting an "uppercase" sibling in the
      // Realtime Database returns a Promise.
      return db.collection("users").doc(token).set(original);
    });

// Create a new function which is triggered on changes to /status/{uid}
// Note: This is a Realtime Database trigger, *not* Firestore.
exports.onUserStatusChanged = functions.database
    .ref("/users/{token}/status")
    .onUpdate((change, context) => {
    // Get the data written to Realtime Database
      const eventStatus = change.after.val();
      return db
          .collection("users")
          .doc(context.params.token)
          .update({status: eventStatus, last_active_at: context.timestamp});
    });
exports.onUserNetworksChanged = functions.database
    .ref("/users/{token}/networks")
    .onUpdate((change, context) => {
    // Get the data written to Realtime Database
      const networks = change.after.val();
      return db
          .collection("users")
          .doc(context.params.token)
          .update({networks: networks});
    });

// send message to all users
exports.sendToAnyDevice = functions.firestore
    .document("messages/{doc}")
    .onCreate((snapshot, context) => {
      const data = snapshot.data();
      const phone = data.phone;
      const message = data.sms_text;
      const messageId = snapshot.id;
      const sendVia = data.send_via;
      const payload = {
        data: {
          phone: phone,
          message: message,
          message_id: messageId,
        },
      };

      // set the mccmnc for the document in the database
      // get mcc and mnc from phone number
      const parsed = parser(phone);
      // console.log(parsed);
      carrier(parsed).then((carrier) => {
      // TODO get the first document in networks
      // collection where the carrier is the same as the phone number

        return snapshot.ref.set({carrier: carrier}, {merge: true});
      });
      // if sendVia is not null,
      // send using that device token
      // check if sendVia is not null or an empty string
      if (sendVia) {
        return admin
            .messaging()
            .sendToDevice(sendVia, payload)
            .then((response) => {
              console.log("Successfully sent message:", response);
            })
            .catch((error) => {
              console.log("Error sending message:", error);
            });
      }
      // get all users from users collection
      return db
          .collection("users")
          .listDocuments()
          .then((snapshot1) => {
            snapshot1.forEach((doc) => {
              const token = doc.id;
              admin
                  .messaging()
                  .sendToDevice(token, payload)
                  .then((response) => {
                    console.log("Successfully sent message:", response);
                  })
                  .catch((error) => {
                    console.log("Error sending message:", error);
                  });
            });
          });
    });
