import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import dayjs from "dayjs"

const app = express()
app.use(express.json())
app.use(cors())
dotenv.config()

let db
const mongoClient = new MongoClient(process.env.DATABASE_URL)
mongoClient.connect()
.then(()=> db = mongoClient.db())
.catch(err => console.log(err.message))


app.post("/participants", (req, res) => {
    const {name} = req.body

    if(!name) {
        return res.sendStatus(422)
    }

    const newParticipant = {name: name, lastStatus: Date.now()}

    db.collection("participants").findOne({name: name})
    .then((data)=>{
        if(data) {
            return res.sendStatus(409)
        } else {
            const now = dayjs().format("HH:mm:ss")
            const loginMessage = {from: name, to:"Todos", text:"entra na sala...", type:"status", time: now}
            db.collection("participants").insertOne(newParticipant)
            .then(()=> {
                db.collection("messages").insertOne(loginMessage)
                .then(res.sendStatus(201))
                .catch(err => console.log(err.message))
            })
            .catch(err => console.log(err.message))
            
        }
    })
    .catch(err=>console.log(err.message))
})

app.get("/participants", (req, res) => {
    db.collection("participants").find().toArray()
    .then((resp)=>{
        res.send(resp)
    })
    .catch()
})

app.post("/messages", (req, res) => {
    const {to, text, type} = req.body
    const userName = req.headers.user
    const time = dayjs().format("HH:mm:ss")

    db.collection("participants").findOne({name: userName})
    .then((resp)=> {
        console.log(resp)
        if(!resp) {
            return res.status(422).send(resp)
        }

        db.collection("messages").insertOne({
            from: userName,
            to,
            text,
            type,
            time
        })
        .then(()=>res.sendStatus(201))
        .catch(err => console.log(err.message))
    })
    .catch(err => console.log(err.message))

})

const PORT = 5000
app.listen(PORT, ()=>console.log(`Server ON na porta:${PORT}`))