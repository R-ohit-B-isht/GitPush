<script>
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
</script>