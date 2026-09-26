function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err.stack);

  // Mongoose throws a CastError when an id in the URL/body isn't a valid
  // ObjectId (e.g. "undefined" from a stale frontend id). That's a bad
  // request, not a server crash, so surface it as 400 instead of a bare 500.
  if (err.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${err.path}: "${err.value}"` });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message || "Server error",
  });
}

module.exports = { notFound, errorHandler };