//role base authorization 

const authorizaRoles = (...allowedRoles/* rest operatror*/)=>{ 
    return(req,res,next)=>{
        if(!req.user|| !allowedRoles.includes(req.user.role)){
            return res.status(403).json({ message:"Access Denied"});
        }
        next()// if everything is okay
    }
}

export {authorizaRoles};