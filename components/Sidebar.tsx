import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
  } from "@/components/ui/command";
import Link from "next/link";
import { LayoutDashboard,
    User,
    Settings,
    MessageCircle,
    Crown}
    from "lucide-react";


const Sidebar = () => {
    return ( 
    <Command className="bg-secondary rounded-none">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <Link href={'/'}>Dashboard</Link>
          </CommandItem>
          <CommandItem>
            <Crown className="mr-2 h-4 w-4" />
            <Link href={'/game'}>Game</Link>
          </CommandItem>
          <CommandItem>
          <MessageCircle className="mr-2 h-4 w-4" />
          <Link href={'/chat'}>Chat</Link>
          </CommandItem>
          <CommandItem>
            <User className="mr-2 h-4 w-4" />
            <Link href={'/'}>Users</Link>
          </CommandItem>
          <CommandItem>
            <Settings className="mr-2 h-4 w-4"/>
            <Link href={'/'}>Settings</Link>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem>Something!!!</CommandItem>
          <CommandItem>Something!!!</CommandItem>
          <CommandItem>Something!!!</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
     );
}
 
export default Sidebar;