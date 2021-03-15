const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const knex = require('knex');
const Clarifai = require('clarifai');

const app1 = new Clarifai.App({
  apiKey: 'c5214b46582841699099ae309b556c1b'
});

const handleApiCall = (req, res) =>{
	app1.models.predict(Clarifai.FACE_DETECT_MODEL, req.body.input)
	.then(data => {
		res.json(data);
	})
	.catch(err => res.status(400).json('unable to work with API'))
}

const db = knex({
  client: 'pg',
  connection: {
    host : '127.0.0.1',
    user : 'postgres',
    password : 'testpassword',
    database : 'smartbrain'
  }
});

const app = express();
app.use(express.json());
app.use(cors());

app.get('/', (req,res)=> {
	res.send('Success');
})

app.post('/signin', (req,res)=>{
	const {email, password } = req.body;
	if (!email || !password){
		return res.status(400).json('incorrect form submission');
	}	
	db.select('email', 'hash').from('login')
	.where('email', '=', email)
	.then(data => {
		const isValid = bcrypt.compareSync(password, data[0].hash);
		if (isValid){
			return db.select('*').from('users')
			.where('email', '=', email)
			.then(user => {
				res.json(user[0])
			})
			.catch(err => res.status(400).json('unable to get user'))
		}else{res.status(400).json('wrong credentials')}
	})
	.catch(err => res.status(400).json('wrong credentials'))
})

app.post('/register', (req,res)=>{
	const { email, name, password } = req.body;
	if (!email || !name || !password){
		return res.status(400).json('incorrect form submission');
	}
	const saltRounds = 10;
	const salt = bcrypt.genSaltSync(saltRounds);
	const hash = bcrypt.hashSync(password, salt);
	db.transaction(trx => {
		trx.insert({
			hash: hash,
			email: email
		})
		.into('login')
		.returning('email')
		.then(loginEmail => {
			return trx('users')
			.returning('*')
			.insert({
				email: loginEmail[0],
				name: name,
				joined: new Date()
			})
			.then(user => {
				res.json(user[0]);
			})
		})
		.then(trx.commit)
		.catch(trx.rollback)
	})
	.catch(err => res.status(400).json('unable to register'))
})

app.get('/profile/:id', (req, res)=>{
	const { id } = req.params;
	db.select('*').from('users').where(
		{
			id: id
		}).then(user => {
			if (user.length){
				res.json(user[0]);
			} else{
				res.status(400).json('Not Found')
			}
		}).catch(err => res.status(400).json('Error Getting User'))
})

app.put('/image', (req,res)=>{
	const {id} = req.body;
	db('users').where('id', '=', id)
	.increment('entries', 1)
	.returning('entries')
	.then(entries => {
		res.json(entries[0]);
	}).catch(err => res.status(400).json('Unable to get entries'))
})

app.post('/imageurl', (req, res) => {
	handleApiCall(req, res)
})

app.listen(process.env.PORT || 3000, ()=>{
	console.log(`app is running on port ${process.env.PORT}`)
})
