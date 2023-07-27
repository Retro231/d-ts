const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { translate } = require("bing-translate-api");
const cors = require("cors");

const app = express();
app.use(cors());

require("dotenv").config();
const port = process.env.PORT || 9001;

const googleCloudConfig = require("./config/d-test-172e9-3a9ade10ddd9.js");

// firebase
const serviceAccount = JSON.parse(JSON.stringify(googleCloudConfig));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

app.get("/", (req, res) => {
  res.send("Hello world!");
});

app.post(
  "/translate",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const data = JSON.parse(req.body);
    let opt1, opt2, opt3, opt4, ques;
    let trans_opt1, trans_opt2, trans_opt3, trans_opt4, trans_ques;
    ques = data.question;
    opt1 = data.answers[0];
    opt2 = data.answers[1];
    opt3 = data.answers[2];
    opt4 = data.answers[3];

    trans_ques = await translate(ques, null, "bn");
    trans_opt1 = await translate(opt1, null, "bn");
    trans_opt2 = await translate(opt2, null, "bn");
    trans_opt3 = await translate(opt3, null, "bn");
    trans_opt4 = await translate(opt4, null, "bn");

    let trans_data = {
      question: trans_ques.translation,
      answers: [
        trans_opt1.translation,
        trans_opt2.translation,
        trans_opt3.translation,
        trans_opt4.translation,
      ],
    };

    res.send(trans_data);
  }
);

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    let event = request.body;
    // Replace this endpoint secret with your endpoint's unique secret
    // If you are testing with the CLI, find the secret by running 'stripe listen'
    // If you are using an endpoint defined with the API or dashboard, look in your webhook settings
    // at https://dashboard.stripe.com/webhooks
    // This is your Stripe CLI webhook secret for testing your endpoint locally.
    const endpointSecret = process.env.STRIPE_WEB_HOOK_SECRET;
    // Only verify the event if you have an endpoint secret defined.
    // Otherwise use the basic event deserialized with JSON.parse
    if (endpointSecret) {
      // Get the signature sent by Stripe
      const signature = request.headers["stripe-signature"];
      try {
        event = stripe.webhooks.constructEvent(
          request.body,
          signature,
          endpointSecret
        );
      } catch (err) {
        console.log(`⚠️  Webhook signature verification failed.`, err.message);
        return response.sendStatus(400);
      }
    }
    let subscription;
    let status;
    let uid;
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        subscription = event.data.object;
        status = subscription.status;
        uid = subscription.client_reference_id;
        const docRef = await db
          .collection("users")
          .doc(uid)
          .collection("subscriptionInfo")
          .add({
            subscribe: "true",
          });
        console.log(subscription);
        console.log(uid);
        console.log(`checkout status is ${status}.`);
        break;
      case "payment_intent.succeeded":
        subscription = event.data.object;
        status = subscription.status;
        console.log(`payment_intent status is ${status}.`);
        break;
      default:
        // Unexpected event type
        console.log(`Unhandled event type ${event.type}.`);
    }
    // Return a 200 response to acknowledge receipt of the event
    response.send();
  }
);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
