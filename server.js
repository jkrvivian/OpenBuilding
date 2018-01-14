const express = require('express')
const https = require('https')
const fs = require('fs')
const secret = require('./secret.js') /* ssl and DB info */
const Design = require('./dbOperation.js')
const bodyParser = require('body-parser')
const await = require('await')
const app = express()
const port = 8181
const MongoClient = require('mongodb').MongoClient;
const dbPath = secret.dbPath;

/* https setting */
const credential = {ca: secret.CA, key: secret.privateKey, cert: secret.certificate}

app.use(express.static(__dirname + '/public'))
app.use(bodyParser.urlencoded({
    extended: true
}));

httpsServer = https.createServer(credential, app)
httpsServer.listen(port, function () {
  console.log('listening on port ' + port)
})

app.post("/newDesign", function (req, res) {
    var account = req.body['account'];
    if(account === "")
        res.send(404);
    else {
    Design.getDesign(account).then((design) => {
        if (design === "House sold out!" || design === "Please Login First!") {
            res.send({
                success: false,
                file: design
            })
        } else {
            res.send({
                success: true,
                file: JSON.parse(design)
            })
        }
    });
    }
})

app.post("/updateDesign", function (req, res) {
  var account = req.body['account'];
  var design = req.body['design'];
  var pic = req.body['pic'];
  Design.saveDesign(account, design, pic).then((result) => {
    res.send("Success!");
  }).catch((e) => {
    res.send("Fail!");
  });
})

app.post("/getTags", function (req, res) {
  var account = req.body['account'];
  Design.getTag(account).then((result) => {
    res.send(result);
  }).catch((e) => {
    res.send("Fail!");
  });
})

app.post("/addTags", function (req, res) {
  var account = req.body['account'];
  var tags = req.body['tags'];
  Design.updateTag(account, tags, 0).then((result) => {
    res.send("success!");
  }).catch((e) => {
    res.send("Fail!");
  });
})

app.post("/deleteTags", function (req, res) {
  var account = req.body['account'];
  var tags = req.body['tags'];
  Design.updateTag(account, tags, 1).then((result) => {
    res.send("success!");
  }).catch((e) => {
    res.send("remove Fail!");
  });
})

app.post("/search", function (req, res) {
  var keyword = req.body['keyword'];
  Design.search(keyword).then((result) => {
    res.send(result);
  }).catch((e) => {
    res.send("Fail!");
  });
})

app.post('/renew',function(req, res){
    MongoClient.connect(dbPath, function(err1, db1) {
        if (err1) throw err1;
        db1.collection("empty_community").find({//取得社區資料
            community_id: 1
        }).toArray(function(err2, result1){
            if (err2) throw err2
            if (result1 != 0) {
                var c_date=result1[0].update_time;//community's renew date
                var c_file=result1[0].community_file;//community's file info
                var communityX = 0;
                var communityY = 0;
                var communitymaxY = 0;
                var Group_obj = JSON.parse(c_file);

                MongoClient.connect(dbPath, function(err3, db2) {
                    if (err3) throw err3;
                    db2.collection("design_info").find({//取得須更新資料
                        last_modified_time: {$gte: c_date}//搜尋日期在c_date後的
                    }).toArray(function(err4,result2){
                        if (err4) throw err4;

                        for (i = 0; i < result2.length; ++i) {
                            
                            var design = JSON.parse(result2[i].design);
                            var user_name = "user" + result2[i].design_id;
                                
                            var minX = 99999999
                            var minY = 99999999
                            var maxX = -99999999
                            var maxY = -99999999

                            // Calculate house min rect
                            for (j in design.floorplan.corners) {
                                if (design.floorplan.corners[j].x < minX)
                                    minX = design.floorplan.corners[j].x
                                if (design.floorplan.corners[j].y < minY)
                                    minY = design.floorplan.corners[j].y
                                if (design.floorplan.corners[j].x > maxX)
                                    maxX = design.floorplan.corners[j].x
                                if (design.floorplan.corners[j].y > maxY)
                                    maxY = design.floorplan.corners[j].y
                            }
                                
                            var rangeX = minX - communityX
                            var rangeY = minY - communityY

                            // Add corners
                            for (j in design.floorplan.corners)
                                j = user_name + "_" + j;

                            for (j in design.floorplan.corners) {
                                Group_obj.floorplan.corners[user_name + "_" + j] = {"x": design.floorplan.corners[j].x - rangeX, "y": design.floorplan.corners[j].y - rangeY}
                            }
                            
                            // Add walls
                            for (j = 0; j < design.floorplan.walls.length; j++) {
                                design.floorplan.walls[j].corner1 = user_name + "_" + design.floorplan.walls[j].corner1
                                design.floorplan.walls[j].corner2 = user_name + "_" + design.floorplan.walls[j].corner2
                            }

                            for (j = 0; j < design.floorplan.walls.length; j++) {
                                Group_obj.floorplan.walls.push(design.floorplan.walls[j])
                            }

                            // Add items
                            for (j = 0; j < design.items.length; ++j) {
                                design.items[j].xpos = design.items[j].xpos - rangeX
                                design.items[j].zpos = design.items[j].zpos - rangeY
                                design.items[j].item_name = user_name + "_" + design.items[j].item_name
                            }
                            for (j = 0; j < design.items.length; ++j) {
                                Group_obj.items.push(design.items[j]);
                            }

                            communityX = communityX + (maxX - minX) + 200
                            if ((maxY - minY) > communitymaxY)
                                communitymaxY = maxY - minY

                            if (communityX > 5000) {
                                communityY = communityY + 600 + communitymaxY
                                communityX = 0
                                communitymaxY = 0
                            }

                        }
                        res.send({
                            file: Group_obj
                        })
                    })
                    db2.close()
                })//db2 connect
            }
        })
        db1.close();
    })//db1 connect
})//app.post

app.post('/login', function(req, res) {
    var account = req.body['account'];
    var pwd = req.body['pwd'];
    
    MongoClient.connect(dbPath, function (err, db) {
   		var promise = new Promise(function(resolve, reject) {
            db.collection("user").find({
            account: account
            }).toArray(function(err, result) {
                if(err) reject(err);
                else resolve(result);
            });
        });
        promise.then(function(result) {
            if(result == 0) {
                res.send({
                    success: false,
                    account: false,
                    password: false
                })
            } else {
                if(result[0].password == pwd) {
                    res.send({
                        success: true,
                        data: result[0]
                    })
                } else {
                    res.send({
                        success: false,
                        account: true,
                        password: false
                    })
                }
            }
            db.close();
  		}).catch(function(err) {
            throw err;
        });
	});
})

app.post('/register', function(req, res) {
    var account = req.body['account'];
    var pwd = req.body['pwd'];
    var nickname = req.body['nickname'];
    var email = req.body['email'];
    var user_id;

    MongoClient.connect(dbPath, function (err, db) {
        if(err) throw err;
        
        var promise = new Promise(function(resolve, reject) {
            db.collection("user").find({
                account: account
            }).toArray(function(err, result) {
                if(err) reject(err);
                else resolve(result);
            });
        });
        
        promise.then(function(result) {
            if(result != 0) {
                res.send({
                    success: false,
                    account: false
                })
                db.close();
                return new Promise(function(resolve, reject) {
                    resolve(-1);
                });
            } else {
                return new Promise(function(resolve, reject) {
                    db.collection("user").find({
                    }).toArray(function(err, result) {
                        user_id = result.length + 1;
                        resolve(user_id);
                    });
                });
            }
        }).then(function(user_id) {
            if(user_id == -1) {
                return new Promise(function(resolve, reject) {
                    resolve(-1);
                });
            } else {
                return new Promise(function(resolve, reject) {
                    db.collection("user").find({
                        email: email
                    }).toArray(function(err, result) {
                        resolve(result);
                    });
                });
            }
        }).then(function(result) {
            db.close();
            if(result == -1) {
            } else if(result != 0) {
                res.send({
                    success: false,
                    account: true,
                    email: false
                })
            } else {
                MongoClient.connect(dbPath, function (err, db) {
                    db.collection("user").insertOne({
  	                    account: account,
                        password: pwd,
                        email: email,
                        nickname: nickname,
                        user_id: user_id
                    }, function(err1, res1) {
                        res.send({
                            success: true
                        })
                    });
                    db.close();
	            });
            }
        }).catch(function(err) {
            console.log(err);
        });
	});
});

app.post('/google_login', function(req, res) {
    var id_token = req.body['id_token'];
    var nickname = req.body['name'];
    var email = req.body['email'];
    var user_id;

    MongoClient.connect(dbPath, function(err, db) {
        var promise = new Promise(function(resolve, reject) {
            db.collection("user").find({
                account: id_token
            }).toArray(function(err, result) {
                if(err) reject(err);
                resolve(result);
            });
        });
    
        promise.then(function(result) {
            if(result == 0) {
                //register
                return new Promise(function(resolve, reject) {
                    db.collection("user").find({
                    }).toArray(function(err, result) {
                        user_id = result.length + 1;
                        resolve(user_id);
                    });
                });
            } else {
                return new Promise(function(resolve, reject) {
                    resolve(0);
                });
            }
        }).then(function(result) {
            if(result != 0) {
                user_id = result;
                return new Promise(function(resolve, reject) {
                    db.close();
                    MongoClient.connect(dbPath, function(err, db) {
                        db.collection("user").insertOne({
                            account: id_token,
                            nickname: nickname,
                            email: email,
                            user_id: user_id
                        }, function(err, result1) {
                            if(err) reject(err);
                        });
                    });
                });
            }
            res.send({
                success: true
            });
        }).catch(function(err) {
            console.log(err);
        });
    });
});
