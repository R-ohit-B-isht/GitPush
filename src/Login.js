//Client id bab5d8701d47e0a6cdc3
//Client Secrtet d096a29d98220f51e1bfb675846aeb0bea7572d1

const target="https://github.com/login/oauth/authorize"
const ClientId="bab5d8701d47e0a6cdc3"

export async function get(request){
    const sessionId="1234"
    return{
        body:'hello'
        // status:302,
        // headers:{
        //     location:`${target}?client_id=${ClientId}&state=${sessionId}`
        // }
    }
}
