'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const data = [
    { name: 'Mon', total: Math.floor(Math.random() * 100) },
    { name: 'Tue', total: Math.floor(Math.random() * 100) },
    { name: 'Wed', total: Math.floor(Math.random() * 100) },
    { name: 'Thu', total: Math.floor(Math.random() * 100) },
    { name: 'Fri', total: Math.floor(Math.random() * 100) },
    { name: 'Sat', total: Math.floor(Math.random() * 100) },
    { name: 'Sun', total: Math.floor(Math.random() * 100) },
];

const ActivityChart = () => {
    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Weekly User Activity</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={data}>
                        <XAxis
                            dataKey="name"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Bar dataKey="total" fill="#adfa1d" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export default ActivityChart; 