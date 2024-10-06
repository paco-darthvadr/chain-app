import './Chessboard.css'
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Piece, Position } from '@/app/models';

interface Props {
    playMove: (piece: Piece, position: Position) => boolean;
    pieces: Piece[];
}


const verticalAxis = ["1", "2", "3", "4", "5", "6", "7", "8"];
const horizontalAxis = ["a", "b", "c", "d", "e", "f", "g", "h"];


export default function Chessboard() {

    let board = [];

    for(let j = verticalAxis.length - 1; j >= 0; j--) {
        for (let i = 0; i < horizontalAxis.length; i++) {
            const number = j + i + 2;

            if(number % 2 === 0) {
                board.push(
                    <div className="tile black-tile" />
                );
            } else {
                board.push(
                    <div className="tile white-tile" />
                );
            }
        }
    }
    
    return ( 
        <>
        <div>
            <div>
                <Card id='boardcard' className='bg-slate-100 dark:bg-slate-800 flex'>
                <Button id='start' className='bg-emerald-600 mt-5'>Ready</Button>
                    <CardContent>
                    <div id="chessboard">{board}</div>
                    </CardContent>
                    <Button id='cancel' className='bg-red-600 mt-5'>Cancel</Button>
                </Card>
            </div>
        </div>
        </>

    );
}
 