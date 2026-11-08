export default (controllerFunction) => (req, res, next) =>
  Promise.resolve(controllerFunction(req, res, next)).catch(next);

// ✅ IMPORTANT This is a wrapper to catch errors in async functions and pass them to the error handler middleware. It prevents the need for try-catch blocks in every controller function.
