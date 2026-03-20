import Image from "next/image";
import Link from "next/link";
import logo from "../img/logo.png"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"

const Navbar = () => {
    return (
      <div className='bg-primary dark:bg-slate-700 text-white py-2 px-5 flex justify-between'>
        <Link href={'/'}>
         <Image src={logo} alt="Verus" width={50}></Image>
        </Link>
        <DropdownMenu>
  <DropdownMenuTrigger className="focus:outline-none">Menu</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>
        <Link href={'/login'}>
        Login
        </Link>
    </DropdownMenuItem>
    <DropdownMenuItem>
        <Link href={'/users'}>
        Users
        </Link>
    </DropdownMenuItem>
    <DropdownMenuItem>
        <Link href={'/dashboard'}>
        Games
        </Link>
    </DropdownMenuItem>
    <DropdownMenuItem>
        <Link href={'/game'}>
        Game
        </Link>
    </DropdownMenuItem>
    <DropdownMenuItem>Spectate</DropdownMenuItem>
    <DropdownMenuItem>Something else</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
      </div>
    );
}
 
export default Navbar;