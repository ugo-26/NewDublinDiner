const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    email: {
        type: String,
        required: true
    }
});
UserSchema.plugin(passportLocalMongoose);
// this plugin helps us automatically add passwords and username fields 

module.exports = mongoose.model('User', UserSchema);