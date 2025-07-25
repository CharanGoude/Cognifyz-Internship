const mongoose = require('mongoose');

const FormDataSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String
});

module.exports = mongoose.model('FormData', FormDataSchema);
