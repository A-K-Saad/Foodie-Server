const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ObjectId } = require("mongodb");
const Razorpay = require("razorpay");
const port = process.env.PORT || 5000;
const app = express();

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vp6kj.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const run = async () => {
  try {
    await client.connect();
    const database = client.db("Foodie");
    const productCollection = database.collection("products");
    const cartCollection = database.collection("carts");
    const userCollection = database.collection("users");
    const orderCollection = database.collection("orders");
    const reviewCollection = database.collection("reviews");
    const ratingCollection = database.collection("ratings");

    app.get("/products", async (req, res) => {
      const result = await productCollection.find({}).toArray();
      res.json(result);
    });
    //Get Specific Data
    app.get("/products/:productId", async (req, res) => {
      const result = await productCollection.findOne({
        _id: ObjectId(req.params.productId),
      });
      res.json(result);
    });
    //Post porduct
    app.post("/products", async (req, res) => {
      const result = await productCollection.insertOne(req.body);
      res.json(result);
    });
    //Delete a Product
    app.delete("/products", async (req, res) => {
      const result = await productCollection.deleteOne({
        _id: ObjectId(req.body._id),
      });
      res.json(result);
    });

    //Update a product and views
    app.put("/products", async (req, res) => {
      const updateType = req.body.updateType;

      if (updateType === "views") {
        const result = await productCollection.updateOne(
          { _id: ObjectId(req.body._id) },
          {
            $set: {
              views: req.body.views,
            },
          }
        );
        res.json(result);
      } else {
        const result = await productCollection.updateOne(
          { _id: ObjectId(req.body._id) },
          {
            $set: {
              name: req.body.name,
              price: req.body.price,
              description: req.body.description,
            },
          }
        );
        res.json(result);
      }
    });

    //Get All Carts
    app.get("/cart", async (req, res) => {
      const result = await cartCollection.find({}).toArray();
      res.json(result);
    });

    //Post Carts
    app.post("/cart", async (req, res) => {
      const result = await cartCollection.insertOne(req.body);
      res.json(result);
    });

    //Get Someone's Full Cart
    app.get(
      "/cart/:userEmail",
      async(req, (res) => {
        const result = await cartCollection
          .find({ userEmail: req.params.userEmail })
          .toArray();
        res.json(result);
      })
    );

    //Get Paginated Reviews
    app.get("/ratings/:productId", async (req, res) => {
      const currentPage = parseInt(req.query.currentPage);
      const limit = parseInt(req.query.limit);
      const result = await ratingCollection
        .find({ productId: req.params.productId })
        .skip(currentPage * limit)
        .limit(limit)
        .toArray();
      res.json(result);
    });
    //Post Product Reivew
    app.post("/ratings", async (req, res) => {
      const result = await ratingCollection.insertOne(req.body);
      res.json(result);
    });
    //Delete Product Review
    app.delete("/ratings", async (req, res) => {
      const result = await ratingCollection.deleteOne({
        _id: ObjectId(req.body._id),
      });
      res.json(result);
    });

    //Post Users
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.json(result);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    });

    app.get("/users", async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.json(result);
    });

    //Verify Admin
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    //Make Admin
    app.put("/users/admin", async (req, res) => {
      const user = req.body.request;
      const requester = req.body.requester;
      if (requester) {
        const requesterAccount = await userCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user };
          const updateDoc = { $set: { role: "admin" } };
          const result = await userCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res.status(403).json({ message: "You Can't Make Admin!" });
      }
    });

    //Place Order
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.json(result);
    });

    app.post("/purchase/:id", async (req, res) => {
      const options = {
        amount: req.body.amount, // amount in the smallest currency unit
        currency: "USD",
        receipt: "order_rcptid_11",
      };
      instance.orders.create(options, (err, order) => {
        res.send({ orderId: order.id });
      });
    });

    app.get("/orders", async (req, res) => {
      const result = await orderCollection.find({}).toArray();
      res.json(result);
    });

    //Upade Status
    app.put("/orders", async (req, res) => {
      const order = req.body;
      const filter = { _id: ObjectId(order.orderId) };
      const updateDoc = { $set: { status: order.status } };
      const result = await orderCollection.updateOne(filter, updateDoc);
      res.json(result);
    });

    //Delete Orders
    app.delete("/orders", async (req, res) => {
      const query = { _id: ObjectId(req.body._id) };
      const result = await orderCollection.deleteOne(query);
      if (result.deletedCount === 1) {
        console.log("Successfully deleted one document.");
      } else {
        console.log("No documents matched the query. Deleted 0 documents.");
      }
    });
    //Get My Orders
    app.get("/my-orders/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: { $regex: email } };

      const result = await orderCollection.find(query).toArray();
      res.json(result);
    });

    //Post Reviews
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.json(result);
    });
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find({}).toArray();
      res.json(result);
    });
    //Payment
    app.get("/get-razorpay-key", (req, res) => {
      res.send({ key: process.env.RAZORPAY_KEY });
    });

    app.post("/create-order", async (req, res) => {
      try {
        const instance = new Razorpay({
          key_id: process.env.RAZORPAY_KEY,
          key_secret: process.env.RAZORPAY_SECRET,
        });
        const options = {
          amount: req.body.amount,
          currency: "USD",
        };
        const order = await instance.orders.create(options);
        if (!order) return res.status(500).send("Some error occured");
        res.send(order);
      } catch (error) {
        console.log("Error Occured");
        res.status(500).send(error);
      }
    });
  } catch (error) {
    console.log(error);
  }
};
run();

app.get("/", (req, res) => {
  res.send("200. Everything is OK.");
});
app.listen(port, () => {
  console.log("200. Everything is OK.");
});
