var mongoose = require("mongoose");

var userSchema = new mongoose.Schema({
    username:  String, // String is shorthand for {type: String}
    id:   Number,
    name : String,
    surname : String,
    approved : {
      type : Boolean,
      default : false
    },
    notifications : {
      type : Boolean,
      default: true
    }
  });

module.exports = mongoose.model("User", userSchema);