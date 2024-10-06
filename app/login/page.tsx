import {getQr} from '../utils/getQr'
import { Button } from "@/components/ui/button";

const Login = () => {
    
    return ( 
        <div>
            <h1 className="text-2xl">
                Login
            </h1>
            <Button onClick={async () => {
                'use server';
                await getQr();
            }}>
            </Button>
        </div>
     );
}
 
export default Login;