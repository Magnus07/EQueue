var mongoose = require("mongoose");

var Schema = mongoose.Schema;

var tutorSchema = new Schema({
    user:  { type: Schema.Types.ObjectId, ref: 'User' },
    subjects : [{ type: Schema.Types.ObjectId, ref: 'Subject' }],
});

module.exports = mongoose.model("Tutor", tutorSchema);