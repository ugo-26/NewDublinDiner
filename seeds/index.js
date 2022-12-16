const mongoose = require('mongoose');
const towns = require('./towns');
const {names} = require('./seedhelpers');
const Dublindiner = require('../models/dublindiner');

const dbUrl = 'mongodb://localhost:27017/dublin-diner';
// process.env.DB_URL
// mongodb://localhost:27017/yelp-camp our original localhost link
mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const sample = array => array[Math.floor(Math.random() * array.length)];

const seedDB = async () => {
    await Dublindiner.deleteMany({});
    for (let i = 0; i < 10; i++) {
        const random10 = Math.floor(Math.random() * 10);
        const price = Math.floor(Math.random() * 10) + 5;
        const diner = new Dublindiner({
            author: '6391b1eeeb1c742594314298',
            location: `${towns[random10].town}`,
            title:`${sample(names)}`,
            image: 'https://images.unsplash.com/photo-1592861956120-e524fc739696?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Nnx8cmVzdGF1cmFudHN8ZW58MHx8MHx8&auto=format&fit=crop&w=600&q=60',
            description: 'We imagine a world where there are no barriers between Dublin residents, sloppily produced pizza doesn’t exist, and local farmers are able to live prosperously',
            price
        })
        await diner.save();
    }
}
seedDB().then(() => {
    mongoose.connection.close();
});