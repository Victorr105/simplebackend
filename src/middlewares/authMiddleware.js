    //dependancies
    import jwt from 'jsonwebtoken';
    import dotenv from "dotenv";/* dotenv configuration*/ dotenv.config();

    const verifyToken = (req,res,next)=>{
        let token ;
        const authHeader = req.headers.authorization || req.headers.Authorization;

        if(authHeader && authHeader.startsWith("Bearer ")){
            token = authHeader.split(" ")[1];
        }

        if(!token){
            return res.status(401).json({message: `No token, Authorization Denied`});
        }
    try{
        const decode = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decode;
            console.log("The decoded user is : ", req.user);
            return next();
    }catch(error){
        return res.status(401).json({ message: `Token not valid` });
    }  
    }

    export{verifyToken};