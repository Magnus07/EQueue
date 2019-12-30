var mongoose = require("mongoose");

var subjectSchema = new mongoose.Schema({
    subject      : String,
});

module.exports = mongoose.model("Subject", subjectSchema);