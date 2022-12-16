const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const {dinerjsSchema, reviewSchema} = require('./validationSchemas.js');
const catchAsync = require('./helpers/catchAsync');
const ExpressError = require('./helpers/ExpressError');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const Dublindiner = require('./models/dublindiner');
const Review = require('./models/reviews');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/newuser');
const mongoSanitizer = require('express-mongo-sanitize');

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
const app = express();

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(mongoSanitizer());

const sesh = {
    name: 'Dinersession',
    secret: 'thisisoursecret',
    // used to make the session deprication warnings go away
    resave: false,
    saveUninitialized: true,
    cookie: {
        // this makes our cookies accessible over http only, not javascipt or other malicious scripts
        httpOnly: true,
        // secure: true,
        // this makes our cookies accessible over https only when it is deployed
        expires: Date.now() + 1000 * 60 * 60 * 24 * 1,
        maxAge: 1000 * 60 * 60 * 24 * 1
    }
}
app.use(session(sesh));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());



app.use((req, res, next) => {
    // console.log(req.session);
    // console.log(req.query);
    res.locals.signedinUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

app.get('/register', (req, res) => {
    res.render('auth/register')
})
app.post('/register', catchAsync(async (req, res) => {
    try{
        const {email, username, password} = req.body
        const newUser = new User({email, username});
        const registeredUser = await User.register(newUser, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            req.flash('success', 'welcome to Dublin diners');
            res.redirect('/diners');
        })
        
    } catch(e) {
        req.flash('error', e.message);
        res.redirect('/register')
    }
}));

app.get('/login', (req, res) => { 
    res.render('auth/login');
})

app.post('/login', passport.authenticate('local', {failureFlash:true, failureRedirect: '/login'}), (req, res) => {
    req.flash('success', 'welcome back');
    const returnUrl = req.session.returnTo || '/diners';
    // didn't work ////
    // deleting the returnto link from session after logging in
    // delete req.session.returnTo;
    res.redirect(returnUrl);
})

/// LOG OUT //////
app.get('/logout', (req, res, next) => {
    req.logout(function(err) {
      if (err) { return next(err); }
      req.flash('success', "You've logged out");
      res.redirect('/diners');
    });
  }); 


// LOG IN MIDDLEWARE //////
const Loggedin = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl
    req.flash('error', 'Sorry, you must be signed in first');
    return res.redirect('/login');
}
next();
}



const backendValidation = (req, res, next) => {
    const {error} = dinerjsSchema.validate(req.body);
    if(error) {
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg, 400);
    }else {
        next();
    }
}
const validatedinerReview = (req, res, next) => {
    const {error} = reviewSchema.validate(req.body);
    if(error) {
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg, 400);
    } else {
        next();
    }
}



// Our authorization middleware preventing signed in users from updating,editing or going to routes they are not permitted to ////
const didYouPost = async(req, res, next) => {
    const {id} = req.params;
    const diner = await Dublindiner.findById(id);
    if(!diner.author.equals(req.user._id)) {
        req.flash('error', 'You cannot do that if you did not post the diner');
        return res.redirect(`/diners/${id}`);
    }
    next()
}





app.get('/', (req, res) => {
    res.render('home')
});

app.get('/diners', async (req, res) => { 
    const diners = await Dublindiner.find({});
    res.render('diners/index', {diners});
});
app.get('/diners/new', Loggedin, (req, res) => {
    res.render('diners/new');
});

app.post('/diners', Loggedin, catchAsync(async (req, res, next) => {
    const diner = new Dublindiner(req.body.diner);
    diner.author = req.user._id;
    await diner.save();
    req.flash('success', 'You have added a new diner')
    res.redirect(`/diners/${diner._id}`); 
}));
app.get('/diners/:id', catchAsync(async (req, res) => {
    const diner = await Dublindiner.findById(req.params.id).populate({
        path: 'reviews',
        populate: {
            path: 'author'
        }
    }).populate('author');
   if(!diner){
    req.flash('error', 'Sorry, that diner was not found!');
    return res.redirect('/diners');
   }
   
    res.render('diners/show', {diner});
}));
app.get('/diners/:id/edit', Loggedin, didYouPost, catchAsync(async (req, res) => {
    const diner = await Dublindiner.findById(req.params.id);
    res.render('diners/edit', {diner});
}));
app.put('/diners/:id', Loggedin, didYouPost, backendValidation, catchAsync(async (req, res) => {
    const {id} = req.params;
   const diner = await Dublindiner.findByIdAndUpdate(id, {...req.body.diner});
   req.flash('success', 'Diner updated successfully');
   res.redirect(`/diners/${diner._id}`); 
}));
app.delete('/diners/:id', Loggedin, didYouPost, catchAsync(async (req, res) => {
    const {id} = req.params;
    await Dublindiner.findByIdAndDelete(id);
    res.redirect('/diners'); 
}));

app.post('/diners/:id/reviews', Loggedin, validatedinerReview, catchAsync(async (req, res) => {
    const diner = await Dublindiner.findById(req.params.id);
    const review = new Review(req.body.review)
    review.author = req.user._id;
    diner.reviews.push(review);
    await review.save();
    await diner.save();
    req.flash('success', 'You have added your review!')
    res.redirect(`/diners/${diner._id}`)
}));

app.delete('/diners/:id/reviews/:reviewId', Loggedin, catchAsync(async(req, res, next) =>{
   const {id, reviewId} = req.params;
   Dublindiner.findByIdAndUpdate(id, {$pull: {reviews: reviewId} })
    await Review.findByIdAndDelete(reviewId);
    req.flash('success', 'Review has been deleted!');
    res.redirect(`/diners/${id}`);
}));


app.all('*',(req, res, next) => {
    next(new ExpressError('Page not found', 404 ))
});

app.use((err, req, res, next) => {
    const {statusCode = 500 } = err;
    if(!err.message) err.message = "OOPS! there was an error";
    res.status(statusCode).render('error', {err});
});

app.listen(3000, () => {
    console.log('serving on port 3000');
});