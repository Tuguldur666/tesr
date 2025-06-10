exports.handleConnection = (req, res) => {
  console.log('/connection received:', req.body);
  res.sendStatus(200);
};

exports.handleTele = (req, res) => {
  console.log('/tele received:', req.body);
  res.sendStatus(200);
};

exports.handleDisconnection = (req, res) => {
  console.log('/discooonection received:', req.body);
  res.sendStatus(200);
};

exports.handleStat = (req, res) => {
  console.log('/stat received:', req.body);
  res.sendStatus(200);
};
