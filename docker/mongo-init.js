db.getSiblingDB("admin").createUser({
  user: process.env.MONGO_APP_USERNAME,
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: "readWriteAnyDatabase", db: "admin" }],
});
